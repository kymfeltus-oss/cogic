from __future__ import annotations

import re
import json
import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Any


DSHOW_CATALOG_TTL_SEC = 60.0


class EncoderService:
    def __init__(self) -> None:
        self._sessions: dict[str, dict[str, Any]] = {}
        self._last_heartbeat = 0.0
        self._dshow_catalog_cache: dict[str, Any] | None = None
        self._dshow_catalog_cached_at = 0.0

    def heartbeat(self) -> None:
        self._last_heartbeat = time.time()

    def _ffmpeg_available(self) -> bool:
        return bool(shutil.which("ffmpeg"))

    def _ffmpeg_disable_audio(self) -> bool:
        """When true, FFmpeg uses -an and video-only dshow (bypasses Windows audio driver bugs)."""
        raw = os.environ.get("FFMPEG_DISABLE_AUDIO", "").strip().lower()
        if raw in ("0", "false", "no"):
            return False
        if raw in ("1", "true", "yes"):
            return True
        # Default video-only on Windows — DirectShow audio names often fail charset matching.
        return sys.platform == "win32"

    def health(self) -> dict[str, Any]:
        vmix = bool(os.getenv("VMIX_API_BASE_URL", "").strip())
        obs = bool(os.getenv("OBS_WEBSOCKET_URL", "").strip())
        ffmpeg_ok = self._ffmpeg_available()
        online = (
            vmix
            or obs
            or ffmpeg_ok
            or (self._last_heartbeat > 0 and (time.time() - self._last_heartbeat) < 120)
        )
        active = sum(1 for s in self._sessions.values() if s.get("started_at") and not s.get("stopped_at"))
        if vmix:
            message = "Local encoder ready (vMix)."
        elif obs:
            message = "Local encoder ready (OBS WebSocket)."
        elif ffmpeg_ok:
            message = "Local encoder ready (FFmpeg RTMP)."
        elif online:
            message = "Local streaming agent online."
        else:
            message = "No local encoder configured. Start the production agent with FFmpeg or vMix."
        return {"online": online, "message": message, "activeSessions": active}

    def _call_vmix(self, fn: str) -> bool:
        vmix_url = os.getenv("VMIX_API_BASE_URL", "").strip()
        if not vmix_url:
            return False
        import httpx

        response = httpx.get(f"{vmix_url}?Function={fn}", timeout=8.0)
        return response.status_code < 400

    def _build_rtmp_url(self, stream_url: str | None, stream_key: str | None) -> str | None:
        if not stream_url:
            return None
        url = stream_url.rstrip("/")
        if not stream_key:
            return url
        if url.endswith(stream_key):
            return url
        return f"{url}/{stream_key.lstrip('/')}"

    def _normalize_browser_device_label(self, label: str) -> str:
        """Strip browser USB suffix — Chrome reports 'Name (04f2:b829)' but dshow uses 'Name'."""
        cleaned = label.strip()
        cleaned = re.sub(r"\s+\([0-9a-fA-F]{4}:[0-9a-fA-F]{4}\)$", "", cleaned)
        return cleaned.strip()

    def _dshow_match_key(self, label: str) -> str:
        """Encoding-insensitive key — browser 'Intel®' must match FFmpeg 'IntelÂ®' listings."""
        key = self._normalize_browser_device_label(label).lower()
        for token in ("®", "â®", "Â®", "™", "â„¢"):
            key = key.replace(token, "")
        key = re.sub(r"[^a-z0-9]+", " ", key)
        return re.sub(r"\s+", " ", key).strip()

    def _extract_usb_ids(self, label: str) -> tuple[str, str] | None:
        match = re.search(r"\(([0-9a-fA-F]{4}):([0-9a-fA-F]{4})\)\s*$", label.strip())
        if not match:
            return None
        return match.group(1).lower(), match.group(2).lower()

    def _is_virtual_dshow_name(self, name: str) -> bool:
        lower = name.lower()
        return "vmix" in lower or "obs virtual" in lower or lower.endswith(" virtual camera")

    def _fetch_dshow_listing_text(self) -> str:
        if not self._ffmpeg_available() or sys.platform != "win32":
            return ""
        try:
            proc = subprocess.run(
                ["ffmpeg", "-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"],
                capture_output=True,
                text=True,
                timeout=15,
            )
            return f"{proc.stderr or ''}\n{proc.stdout or ''}"
        except Exception:
            return ""

    def _parse_dshow_catalog(self, text: str) -> dict[str, Any]:
        video: list[dict[str, Any]] = []
        audio: list[dict[str, Any]] = []
        pending: dict[str, Any] | None = None
        section: str | None = None

        for line in text.splitlines():
            if "DirectShow video devices" in line:
                section = "video"
                continue
            if "DirectShow audio devices" in line:
                section = "audio"
                continue

            name_match = re.search(r'"([^"]+)"\s+\((video|audio|none)\)', line)
            if name_match:
                name = name_match.group(1).strip()
                media = name_match.group(2)
                entry: dict[str, Any] = {
                    "name": name,
                    "alternative": None,
                    "virtual": self._is_virtual_dshow_name(name),
                }
                pending = entry
                if media == "video":
                    video.append(entry)
                elif media == "audio":
                    audio.append(entry)
                elif media == "none":
                    entry["virtual"] = True
                    video.append(entry)
                continue

            legacy_match = re.search(r'"([^"]+)"', line)
            if legacy_match and section in {"video", "audio"}:
                name = legacy_match.group(1).strip()
                if not name:
                    continue
                entry = {
                    "name": name,
                    "alternative": None,
                    "virtual": self._is_virtual_dshow_name(name),
                }
                pending = entry
                if section == "video":
                    video.append(entry)
                else:
                    audio.append(entry)
                continue

            alt_match = re.search(r'Alternative name\s+"([^"]+)"', line)
            if alt_match and pending is not None:
                pending["alternative"] = alt_match.group(1).strip()
                pending = None

        vmix_virtual_count = sum(
            1 for entry in video + audio if "vmix" in entry["name"].lower()
        )
        return {
            "video": video,
            "audio": audio,
            "vmix_virtual_count": vmix_virtual_count,
        }

    def _get_dshow_catalog(self) -> dict[str, Any]:
        now = time.time()
        if (
            self._dshow_catalog_cache is not None
            and (now - self._dshow_catalog_cached_at) < DSHOW_CATALOG_TTL_SEC
        ):
            self._agent_debug_log(
                "encoder_service.py:_get_dshow_catalog",
                "dshow catalog cache hit",
                {
                    "cacheAgeMs": int((now - self._dshow_catalog_cached_at) * 1000),
                    "videoCount": len(self._dshow_catalog_cache.get("video", [])),
                    "audioCount": len(self._dshow_catalog_cache.get("audio", [])),
                },
                hypothesis_id="H1",
            )
            return self._dshow_catalog_cache

        t0 = time.time()
        catalog = self._parse_dshow_catalog(self._fetch_dshow_listing_text())
        elapsed_ms = int((time.time() - t0) * 1000)
        self._dshow_catalog_cache = catalog
        self._dshow_catalog_cached_at = time.time()
        self._agent_debug_log(
            "encoder_service.py:_get_dshow_catalog",
            "dshow catalog refreshed",
            {
                "elapsedMs": elapsed_ms,
                "videoCount": len(catalog.get("video", [])),
                "audioCount": len(catalog.get("audio", [])),
                "vmixVirtualCount": catalog.get("vmix_virtual_count", 0),
            },
            hypothesis_id="H1",
        )
        return catalog

    def _find_catalog_entry(
        self,
        normalized_label: str,
        pool: list[dict[str, Any]],
        usb_ids: tuple[str, str] | None = None,
    ) -> dict[str, Any] | None:
        if usb_ids:
            vid, pid = usb_ids
            needle = f"vid_{vid}&pid_{pid}"
            for entry in pool:
                alt = entry.get("alternative") or ""
                if needle in alt.lower():
                    return entry

        if normalized_label:
            for entry in pool:
                if entry["name"] == normalized_label:
                    return entry
            lower = normalized_label.lower()
            for entry in pool:
                if entry["name"].lower() == lower:
                    return entry
            for entry in pool:
                name_lower = entry["name"].lower()
                if lower.startswith(name_lower) or name_lower.startswith(lower):
                    return entry

            match_key = self._dshow_match_key(normalized_label)
            if match_key:
                for entry in pool:
                    if self._dshow_match_key(entry["name"]) == match_key:
                        return entry
                for entry in pool:
                    entry_key = self._dshow_match_key(entry["name"])
                    if entry_key and (
                        match_key.startswith(entry_key) or entry_key.startswith(match_key)
                    ):
                        return entry
        return None

    def _catalog_entry_input_name(self, entry: dict[str, Any], prefer_hardware_path: bool) -> str:
        alternative = entry.get("alternative")
        if entry.get("virtual") and isinstance(alternative, str) and alternative.startswith("@device_"):
            return alternative
        if prefer_hardware_path and isinstance(alternative, str) and alternative.startswith(
            ("@device_pnp_", "@device_cm_")
        ):
            return alternative
        return str(entry["name"])

    def _resolve_dshow_device_label(
        self,
        label: str | None,
        kind: str,
        catalog: dict[str, Any] | None = None,
    ) -> str | None:
        if not label or not label.strip():
            return None
        cat = catalog or self._get_dshow_catalog()
        normalized = self._normalize_browser_device_label(label)
        usb_ids = self._extract_usb_ids(label)
        pool = cat.get(kind, [])
        entry = self._find_catalog_entry(normalized, pool, usb_ids)
        if not entry:
            return normalized

        prefer_hardware_path = cat.get("vmix_virtual_count", 0) > 0 and not entry.get("virtual")
        return self._catalog_entry_input_name(entry, prefer_hardware_path)

    def _escape_dshow_label(self, label: str) -> str:
        if label.startswith("@device_"):
            # PnP paths from ffmpeg -list_devices are already formatted for dshow.
            return label.replace('"', '\\"')
        # Colon is the dshow video:audio delimiter — escape any remaining colons in friendly names.
        return label.replace("\\", "\\\\").replace('"', '\\"').replace(":", "\\:")

    def _format_dshow_device_value(self, label: str) -> str:
        if label.startswith("@device_"):
            return label
        return f'"{self._escape_dshow_label(label)}"'

    def _dshow_input(self, video_label: str | None, audio_label: str | None) -> str | None:
        video = video_label.strip() if video_label and video_label.strip() else ""
        audio = audio_label.strip() if audio_label and audio_label.strip() else ""
        if video and audio:
            return f"video={self._format_dshow_device_value(video)}:audio={self._format_dshow_device_value(audio)}"
        if video:
            return f"video={self._format_dshow_device_value(video)}"
        if audio:
            return f"audio={self._format_dshow_device_value(audio)}"
        return None

    def _agent_debug_log(
        self,
        location: str,
        message: str,
        data: dict[str, Any],
        hypothesis_id: str = "H3",
    ) -> None:
        # #region agent log
        try:
            log_path = Path(__file__).resolve().parents[3] / "debug-675ed0.log"
            payload = {
                "sessionId": "675ed0",
                "runId": "go-live-perf",
                "hypothesisId": hypothesis_id,
                "location": location,
                "message": message,
                "data": data,
                "timestamp": int(time.time() * 1000),
            }
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(payload) + "\n")
        except Exception:
            pass
        # #endregion

    def _ffmpeg_io_hint(self, err: str, catalog: dict[str, Any] | None = None) -> str:
        lower = err.lower()
        hints: list[str] = []
        vmix_count = (catalog or {}).get("vmix_virtual_count", 0)
        if vmix_count > 0:
            hints.append(
                f" Close vMix completely ({vmix_count} vMix virtual devices detected — vMix may be holding the physical camera)."
            )
        if "error opening input" in lower or "i/o error" in lower:
            hints.append(
                " Close browser preview, Zoom, Teams, and other webcam apps (DirectShow allows one client)."
            )
            if "output pin" in lower or "obs virtual" in lower:
                hints.append(
                    " Start OBS Virtual Camera output in OBS, then try Go Live again without browser preview holding the device."
                )
            hints.append(
                " Enable Settings → Privacy & Security → Camera → Let desktop apps access your camera."
            )
            hints.append(
                " In Device Manager → Cameras, check for a yellow warning and update/enable the driver."
            )
        if "unknown input format" in lower or "malformed" in lower:
            hints.append(
                " Compare the available DirectShow device list below with ffmpeg -list_devices true -f dshow -i dummy."
            )
        return "".join(hints)

    def _list_dshow_devices(self) -> dict[str, list[str]]:
        catalog = self._get_dshow_catalog()
        return {
            "video": [entry["name"] for entry in catalog.get("video", [])],
            "audio": [entry["name"] for entry in catalog.get("audio", [])],
        }

    def _ffmpeg_failure_response(
        self,
        message: str,
        video_device_label: str | None,
        audio_device_label: str | None,
        ffmpeg_stderr: str,
        catalog: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        stderr = (ffmpeg_stderr or "").strip()[:800]
        cat = catalog or self._get_dshow_catalog()
        devices = self._list_dshow_devices_from_catalog(cat)
        summary = message.strip() or stderr or "FFmpeg could not open the capture device."
        if video_device_label and video_device_label.strip():
            summary = f'{summary} (requested video: "{video_device_label.strip()}")'
        payload = {
            "success": False,
            "message": summary + self._ffmpeg_io_hint(stderr, cat),
            "video_device_label": video_device_label,
            "audio_device_label": audio_device_label,
            "ffmpeg_stderr": stderr,
            "dshow_devices": devices,
        }
        self._agent_debug_log(
            "encoder_service.py:_ffmpeg_failure_response",
            "ffmpeg device open failed",
            {
                "videoDeviceLabel": video_device_label,
                "audioDeviceLabel": audio_device_label,
                "ffmpegStderr": stderr[:400],
                "dshowVideoCount": len(devices.get("video", [])),
                "dshowAudioCount": len(devices.get("audio", [])),
                "vmixVirtualCount": cat.get("vmix_virtual_count", 0),
            },
        )
        return payload

    def _list_dshow_devices_from_catalog(self, catalog: dict[str, Any]) -> dict[str, list[str]]:
        return {
            "video": [entry["name"] for entry in catalog.get("video", [])],
            "audio": [entry["name"] for entry in catalog.get("audio", [])],
        }

    def _stop_ffmpeg(self, session: dict[str, Any]) -> None:
        proc = session.get("ffmpeg_proc")
        if proc and proc.poll() is None:
            try:
                if sys.platform == "win32":
                    proc.terminate()
                else:
                    os.kill(proc.pid, signal.SIGTERM)
                proc.wait(timeout=5)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass
        session["ffmpeg_proc"] = None

    def _probe_ffmpeg_dshow(
        self,
        input_spec: str,
        rtmp_url: str,
        force_disable_audio: bool = False,
    ) -> tuple[bool, subprocess.Popen[str] | None, str]:
        disable_audio = force_disable_audio or self._ffmpeg_disable_audio()
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "dshow",
            "-i",
            input_spec,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-tune",
            "zerolatency",
            "-pix_fmt",
            "yuv420p",
        ]
        if disable_audio:
            cmd.append("-an")
        else:
            cmd.extend(["-c:a", "aac", "-b:a", "128k"])
        cmd.extend(["-f", "flv", rtmp_url])
        try:
            proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
        except OSError as exc:
            return False, None, str(exc)

        time.sleep(0.75)
        if proc.poll() is not None:
            err = ""
            try:
                err = (proc.stderr.read() if proc.stderr else "")[:800]
            except Exception:
                pass
            return False, None, err
        return True, proc, ""

    def _hardware_path_for_label(
        self,
        label: str | None,
        kind: str,
        catalog: dict[str, Any],
    ) -> str | None:
        if not label or not label.strip():
            return None
        normalized = self._normalize_browser_device_label(label)
        usb_ids = self._extract_usb_ids(label)
        entry = self._find_catalog_entry(normalized, catalog.get(kind, []), usb_ids)
        if not entry:
            return None
        alternative = entry.get("alternative")
        if isinstance(alternative, str) and alternative.startswith(("@device_pnp_", "@device_cm_")):
            return alternative
        return None

    def _start_ffmpeg_rtmp(
        self,
        destination_id: str,
        stream_url: str | None,
        stream_key: str | None,
        video_device_label: str | None,
        audio_device_label: str | None,
    ) -> dict[str, Any]:
        if not self._ffmpeg_available():
            return {
                "success": False,
                "message": "FFmpeg is not installed. Install FFmpeg on this production machine.",
            }

        rtmp_url = self._build_rtmp_url(stream_url, stream_key)
        if not rtmp_url:
            return {"success": False, "message": "Stream server URL and stream key are required."}

        if sys.platform != "win32":
            return {
                "success": False,
                "message": "FFmpeg DirectShow capture is configured for Windows production machines.",
            }

        session = self._sessions.get(destination_id) or {}
        self._stop_ffmpeg(session)

        catalog_t0 = time.time()
        catalog = self._get_dshow_catalog()
        catalog_ms = int((time.time() - catalog_t0) * 1000)
        resolved_video = self._resolve_dshow_device_label(video_device_label, "video", catalog)
        resolved_audio = self._resolve_dshow_device_label(audio_device_label, "audio", catalog)
        audio_for_input = None if self._ffmpeg_disable_audio() else resolved_audio
        input_spec = self._dshow_input(resolved_video, audio_for_input)
        if not input_spec:
            return self._ffmpeg_failure_response(
                "No camera device label for FFmpeg. Select a browser camera in Today's Service.",
                video_device_label,
                audio_device_label,
                "",
                catalog,
            )

        self._agent_debug_log(
            "encoder_service.py:_start_ffmpeg_rtmp",
            "ffmpeg dshow input",
            {
                "dshowInput": input_spec,
                "requestedVideoLabel": video_device_label,
                "resolvedVideoLabel": resolved_video,
                "requestedAudioLabel": audio_device_label,
                "resolvedAudioLabel": resolved_audio,
                "vmixVirtualCount": catalog.get("vmix_virtual_count", 0),
                "hasVideoLabel": bool(video_device_label and video_device_label.strip()),
                "hasAudioLabel": bool(audio_device_label and audio_device_label.strip()),
                "ffmpegDisableAudio": self._ffmpeg_disable_audio(),
            },
        )

        probe_t0 = time.time()
        ok, proc, err = self._probe_ffmpeg_dshow(input_spec, rtmp_url)
        probe_ms = int((time.time() - probe_t0) * 1000)
        self._agent_debug_log(
            "encoder_service.py:_start_ffmpeg_rtmp",
            "ffmpeg dshow probe",
            {
                "catalogMs": catalog_ms,
                "probeMs": probe_ms,
                "probeOk": ok,
                "dshowInput": input_spec,
                "ffmpegDisableAudio": self._ffmpeg_disable_audio(),
                "probeError": (err or "")[:200] if not ok else None,
            },
            hypothesis_id="H2",
        )
        if not ok:
            err_lower = (err or "").lower()
            hardware_video = self._hardware_path_for_label(video_device_label, "video", catalog)
            hardware_audio = (
                None
                if self._ffmpeg_disable_audio()
                else self._hardware_path_for_label(audio_device_label, "audio", catalog)
            )
            used_hardware_path = resolved_video and str(resolved_video).startswith("@device_")
            should_retry = (
                not used_hardware_path
                and (hardware_video or hardware_audio)
                and ("error opening input" in err_lower or "i/o error" in err_lower or "malformed" in err_lower)
            )
            if should_retry:
                retry_video = hardware_video or resolved_video
                retry_audio = hardware_audio if not self._ffmpeg_disable_audio() else None
                retry_spec = self._dshow_input(retry_video, retry_audio)
                if retry_spec and retry_spec != input_spec:
                    self._agent_debug_log(
                        "encoder_service.py:_start_ffmpeg_rtmp",
                        "retrying ffmpeg with hardware device path",
                        {
                            "retryInput": retry_spec,
                            "retryVideo": retry_video,
                            "retryAudio": retry_audio,
                        },
                    )
                    ok, proc, err = self._probe_ffmpeg_dshow(retry_spec, rtmp_url)
                    if ok:
                        input_spec = retry_spec
                        resolved_video = retry_video
                        resolved_audio = retry_audio

            if not ok:
                err_lower = (err or "").lower()
                audio_related = (
                    "could not find audio" in err_lower
                    or "audio only device" in err_lower
                    or ":audio=" in err_lower
                )
                if audio_related and resolved_video:
                    video_only_spec = self._dshow_input(resolved_video, None)
                    if video_only_spec and video_only_spec != input_spec:
                        self._agent_debug_log(
                            "encoder_service.py:_start_ffmpeg_rtmp",
                            "retrying ffmpeg video-only after audio failure",
                            {
                                "retryInput": video_only_spec,
                                "priorError": (err or "")[:200],
                            },
                            hypothesis_id="H-audio",
                        )
                        ok, proc, err = self._probe_ffmpeg_dshow(
                            video_only_spec,
                            rtmp_url,
                            force_disable_audio=True,
                        )
                        if ok:
                            input_spec = video_only_spec
                            resolved_audio = None

        if not ok or proc is None:
            return self._ffmpeg_failure_response(
                (err or "").strip() or "FFmpeg exited immediately.",
                video_device_label,
                audio_device_label,
                err,
                catalog,
            )

        session.update(
            {
                "destination_id": destination_id,
                "stream_url": stream_url,
                "stream_key": stream_key,
                "video_device_label": video_device_label,
                "audio_device_label": audio_device_label,
                "ffmpeg_proc": proc,
                "started_at": time.time(),
                "stopped_at": None,
            }
        )
        self._sessions[destination_id] = session
        return {
            "success": True,
            "message": f"FFmpeg is pushing RTMP to Restream ({rtmp_url.split('/')[-2]}/…).",
        }

    def prepare(
        self,
        destination_id: str,
        stream_url: str | None,
        stream_key: str | None,
        video_device_label: str | None = None,
        audio_device_label: str | None = None,
    ) -> dict[str, Any]:
        self.heartbeat()
        if not stream_url and not stream_key:
            return {"success": False, "message": "Stream server URL and stream key are required."}

        vmix = bool(os.getenv("VMIX_API_BASE_URL", "").strip())
        obs = bool(os.getenv("OBS_WEBSOCKET_URL", "").strip())
        ffmpeg_ok = self._ffmpeg_available()
        if not vmix and not obs and not ffmpeg_ok:
            return {
                "success": False,
                "message": "No local encoder is configured. Start the production agent with FFmpeg or vMix.",
            }

        self._sessions[destination_id] = {
            "destination_id": destination_id,
            "stream_url": stream_url,
            "stream_key": stream_key,
            "video_device_label": video_device_label,
            "audio_device_label": audio_device_label,
            "prepared_at": time.time(),
            "started_at": None,
            "stopped_at": None,
            "ffmpeg_proc": None,
        }
        return {"success": True, "message": "Encoder prepared for streaming."}

    def start(
        self,
        destination_id: str,
        stream_url: str | None,
        stream_key: str | None,
        video_device_label: str | None = None,
        audio_device_label: str | None = None,
    ) -> dict[str, Any]:
        start_t0 = time.time()
        self.heartbeat()
        session = self._sessions.get(destination_id)
        if not session:
            prepared = self.prepare(
                destination_id,
                stream_url,
                stream_key,
                video_device_label,
                audio_device_label,
            )
            if not prepared.get("success"):
                return prepared
            session = self._sessions[destination_id]

        video_label = video_device_label or session.get("video_device_label")
        audio_label = audio_device_label or session.get("audio_device_label")

        browser_ffmpeg_path = bool(video_label and audio_label)
        if not browser_ffmpeg_path and self._call_vmix("StartStreaming"):
            session["started_at"] = time.time()
            session["stopped_at"] = None
            return {"success": True, "message": "vMix streaming started."}

        ffmpeg_result = self._start_ffmpeg_rtmp(
            destination_id,
            stream_url or session.get("stream_url"),
            stream_key or session.get("stream_key"),
            video_label,
            audio_label,
        )
        self._agent_debug_log(
            "encoder_service.py:start",
            "encoder start finished",
            {
                "elapsedMs": int((time.time() - start_t0) * 1000),
                "success": bool(ffmpeg_result.get("success")),
            },
            hypothesis_id="H2",
        )
        return ffmpeg_result

    def stop(self) -> dict[str, Any]:
        self.heartbeat()
        stopped = False
        if self._call_vmix("StopStreaming"):
            stopped = True
        if self._call_vmix("StopRecording"):
            stopped = True

        now = time.time()
        for session in self._sessions.values():
            if session.get("ffmpeg_proc"):
                self._stop_ffmpeg(session)
                stopped = True
            if session.get("started_at") and not session.get("stopped_at"):
                session["stopped_at"] = now

        if stopped:
            return {"success": True, "message": "Local encoder stopped."}
        if self._sessions:
            return {"success": False, "message": "Could not reach local encoder to stop streaming."}
        return {"success": False, "message": "No active encoder session to stop."}

    def preview_stats(self, destination_id: str) -> dict[str, Any]:
        self.heartbeat()
        session = self._sessions.get(destination_id) or {}
        vmix_url = os.getenv("VMIX_API_BASE_URL", "").strip()
        dropped_frames = 0
        current_bitrate_kbps = 0
        current_fps = 0.0
        network_mbps = 0.0

        proc = session.get("ffmpeg_proc")
        ffmpeg_running = bool(proc and proc.poll() is None)

        if vmix_url:
            import httpx

            try:
                response = httpx.get(vmix_url, timeout=6.0)
                if response.status_code < 400 and "<streaming>" in response.text.lower():
                    text = response.text
                    if "bitrate" in text.lower():
                        for token in text.replace(">", " ").replace("<", " ").split():
                            if token.replace(".", "", 1).isdigit() and float(token) > 100:
                                current_bitrate_kbps = max(current_bitrate_kbps, int(float(token)))
                    current_fps = 30.0
                    network_mbps = round(current_bitrate_kbps / 1000, 2) if current_bitrate_kbps else 0.0
            except Exception:
                pass

        cpu_percent = 0.0
        gpu_percent = 0.0
        try:
            import psutil

            cpu_percent = float(psutil.cpu_percent(interval=0.2))
        except Exception:
            pass

        if shutil.which("nvidia-smi"):
            try:
                out = subprocess.check_output(
                    ["nvidia-smi", "--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"],
                    text=True,
                    timeout=4.0,
                )
                gpu_percent = float(out.strip().splitlines()[0])
            except Exception:
                pass

        online = bool(vmix_url) or ffmpeg_running or bool(session.get("prepared_at"))
        if ffmpeg_running:
            current_fps = 30.0
            current_bitrate_kbps = max(current_bitrate_kbps, 2500)
            network_mbps = max(network_mbps, 2.5)

        return {
            "online": online,
            "message": "Encoder preview active." if online else "Prepare the encoder to view live stats.",
            "droppedFrames": dropped_frames,
            "currentBitrateKbps": current_bitrate_kbps,
            "currentFps": current_fps,
            "encoderUsagePercent": min(100.0, cpu_percent + gpu_percent * 0.5),
            "gpuUsagePercent": gpu_percent,
            "cpuUsagePercent": cpu_percent,
            "networkThroughputMbps": network_mbps,
            "audioLevels": {"left": 0.0, "right": 0.0},
        }

    def list_devices(self) -> dict[str, Any]:
        self.heartbeat()
        catalog = self._get_dshow_catalog()
        devices = self._list_dshow_devices_from_catalog(catalog)
        return {
            "success": True,
            "video": devices.get("video", []),
            "audio": devices.get("audio", []),
        }


encoder_service = EncoderService()
