from __future__ import annotations

import platform
import re
import subprocess
from typing import Any

from app.audio.mixers.registry import get_mixer_driver


def _run_command(args: list[str], timeout: float = 12.0) -> tuple[int, str]:
    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        output = (result.stdout or "") + (result.stderr or "")
        return result.returncode, output
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as exc:
        return 1, str(exc)


def _connection_type_from_hostapi(name: str) -> str:
    lower = name.lower()
    if "wasapi" in lower:
        return "wasapi"
    if "core" in lower:
        return "coreaudio"
    if "asio" in lower:
        return "asio"
    return "usb"


def _guess_manufacturer(label: str) -> str | None:
    lower = label.lower()
    brands = [
        ("behringer", "Behringer"),
        ("midas", "Midas"),
        ("allen", "Allen & Heath"),
        ("yamaha", "Yamaha"),
        ("shure", "Shure"),
        ("audio-technica", "Audio-Technica"),
        ("focusrite", "Focusrite"),
        ("presonus", "PreSonus"),
        ("motu", "MOTU"),
        ("rme", "RME"),
    ]
    for token, name in brands:
        if token in lower:
            return name
    return None


def _parse_dshow_audio(output: str) -> list[dict[str, Any]]:
    devices: list[dict[str, Any]] = []
    in_audio = False
    index = 0
    for line in output.splitlines():
        if "DirectShow audio devices" in line:
            in_audio = True
            continue
        if in_audio and ("DirectShow video" in line or "dummy:" in line):
            break
        match = re.search(r'"([^"]+)"', line)
        if in_audio and match:
            label = match.group(1).strip()
            if not label:
                continue
            devices.append(
                {
                    "id": f"dshow-audio:{index}:{label}",
                    "label": label,
                    "connectionType": "wasapi",
                    "hardwareLabel": label,
                    "deviceIndex": index,
                    "manufacturer": _guess_manufacturer(label),
                    "model": None,
                    "sampleRate": 48000,
                    "channels": 2,
                    "status": "available",
                    "source": "agent_dshow",
                }
            )
            index += 1
    return devices


def _discover_portaudio() -> tuple[list[dict[str, Any]], str | None]:
    try:
        import sounddevice as sd  # type: ignore[import-untyped]
    except ImportError:
        return [], "sounddevice is not installed on the production agent."

    devices: list[dict[str, Any]] = []
    hostapis = sd.query_hostapis()
    for index, dev in enumerate(sd.query_devices()):
        if int(dev.get("max_input_channels", 0)) < 1:
            continue
        hostapi_name = hostapis[dev["hostapi"]]["name"]
        label = str(dev.get("name", f"Input {index}"))
        default_sr = int(dev.get("default_samplerate", 48000) or 48000)
        channels = int(dev.get("max_input_channels", 1))
        devices.append(
            {
                "id": f"portaudio:{index}:{label}",
                "label": label,
                "connectionType": _connection_type_from_hostapi(hostapi_name),
                "hardwareLabel": label,
                "deviceIndex": index,
                "manufacturer": _guess_manufacturer(label),
                "model": None,
                "sampleRate": default_sr,
                "channels": channels,
                "status": "available",
                "source": f"agent_{hostapi_name.lower().replace(' ', '_')}",
            }
        )
    return devices, None


def _discover_ffmpeg_audio() -> list[dict[str, Any]]:
    system = platform.system().lower()
    if system == "windows":
        _, output = _run_command(["ffmpeg", "-list_devices", "true", "-f", "dshow", "-i", "dummy"])
        return _parse_dshow_audio(output)
    return []


def discover_audio_devices(mixer_type: str = "behringer_x32", hint_ips: list[str] | None = None) -> dict[str, Any]:
    devices: dict[str, dict[str, Any]] = {}

    portaudio_devices, portaudio_error = _discover_portaudio()
    for item in portaudio_devices:
        devices[item["id"]] = item

    if not portaudio_devices:
        for item in _discover_ffmpeg_audio():
            devices[item["id"]] = item

    try:
        driver = get_mixer_driver(mixer_type)
        found = driver.scan_network(hint_ips or [], 10023, 1500)
        for mixer in found:
            ip = mixer.get("ipAddress") or mixer.get("ip")
            if not ip:
                continue
            label = f"{mixer.get('manufacturer', 'Mixer')} {mixer.get('model', '')}".strip()
            device_id = f"mixer:{mixer_type}:{ip}"
            devices[device_id] = {
                "id": device_id,
                "label": label or "Network Mixer",
                "connectionType": "ethernet_mixer",
                "hardwareLabel": label,
                "deviceIndex": None,
                "manufacturer": mixer.get("manufacturer"),
                "model": mixer.get("model"),
                "sampleRate": None,
                "channels": mixer.get("channelCount"),
                "status": "available",
                "source": "agent_mixer_scan",
                "mixerType": mixer_type,
                "mixerIp": ip,
            }
    except Exception:  # noqa: BLE001
        pass

    agent_available = bool(portaudio_devices) or bool(_discover_ffmpeg_audio())
    message = "Scan complete."
    if not devices:
        if portaudio_error:
            message = (
                f"No audio input devices found. {portaudio_error} "
                "Install PortAudio and sounddevice on the production computer, or connect a USB interface."
            )
        else:
            message = "No audio input devices or mixers found on this computer."

    return {
        "devices": list(devices.values()),
        "agentAvailable": agent_available,
        "message": message,
    }


def _read_portaudio_levels(device_index: int, duration_ms: int = 150) -> dict[str, Any]:
    import numpy as np  # type: ignore[import-untyped]
    import sounddevice as sd  # type: ignore[import-untyped]

    info = sd.query_devices(device_index)
    sample_rate = int(info.get("default_samplerate", 48000) or 48000)
    channels = min(int(info.get("max_input_channels", 1)), 2)
    frames = max(int(sample_rate * duration_ms / 1000), 1)

    data = sd.rec(frames, samplerate=sample_rate, channels=channels, device=device_index, dtype="float32")
    sd.wait()

    if data.size == 0:
        return {
            "inputLevel": 0.0,
            "peak": 0.0,
            "rms": 0.0,
            "clipping": False,
            "signalPresent": False,
            "sampleRate": sample_rate,
            "channels": channels,
        }

    peak = float(np.max(np.abs(data)))
    rms = float(np.sqrt(np.mean(np.square(data))))
    db_peak = 20 * np.log10(max(peak, 1e-9))
    db_rms = 20 * np.log10(max(rms, 1e-9))
    normalized = max(0.0, min(1.0, (db_rms + 60) / 60))
    signal_present = db_rms > -50

    return {
        "inputLevel": round(normalized * 100, 1),
        "peak": round(float(db_peak), 1),
        "rms": round(float(db_rms), 1),
        "clipping": peak >= 0.99,
        "signalPresent": signal_present,
        "sampleRate": sample_rate,
        "channels": channels,
    }


def read_device_levels(device: dict[str, Any], duration_ms: int = 150) -> dict[str, Any]:
    connection_type = device.get("connectionType", "usb")
    if connection_type == "ethernet_mixer":
        mixer_ip = device.get("mixerIp")
        mixer_type = device.get("mixerType") or "behringer_x32"
        if not mixer_ip:
            return {"success": False, "message": "Mixer IP is required for level metering."}
        driver = get_mixer_driver(mixer_type)
        detection = driver.audio_detection(mixer_ip, 10023, max(duration_ms, 500))
        inputs = detection.get("inputs") or []
        best = inputs[0] if inputs else None
        level = float(best.get("levelDb", -80)) if best else -80
        normalized = max(0.0, min(1.0, (level + 60) / 60))
        signal_present = bool(best and best.get("signalPresent"))
        return {
            "success": True,
            "inputLevel": round(normalized * 100, 1),
            "peak": level,
            "rms": level,
            "clipping": level >= -1,
            "signalPresent": signal_present,
            "sampleRate": None,
            "channels": detection.get("channelCount"),
        }

    device_index = device.get("deviceIndex")
    if device_index is None:
        return {"success": False, "message": "Device index is required for live metering."}

    try:
        levels = _read_portaudio_levels(int(device_index), duration_ms)
        return {"success": True, **levels}
    except ImportError:
        return {
            "success": False,
            "message": "Live metering requires sounddevice on the production agent.",
        }
    except Exception as exc:  # noqa: BLE001
        return {"success": False, "message": str(exc)}


def test_audio_device(device: dict[str, Any], mixer_port: int = 10023, timeout_ms: int = 3000) -> dict[str, Any]:
    connection_type = device.get("connectionType", "usb")

    if connection_type == "ethernet_mixer":
        mixer_ip = device.get("mixerIp")
        mixer_type = device.get("mixerType") or "behringer_x32"
        if not mixer_ip:
            return {"success": False, "message": "Mixer IP address is required."}
        driver = get_mixer_driver(mixer_type)
        probe = driver.test_connection(mixer_ip, mixer_port, timeout_ms, 1)
        if not probe.success:
            return {
                "success": False,
                "message": probe.message,
                "steps": [
                    {"label": "Device opened", "ok": False},
                ],
            }
        health = driver.health_check(mixer_ip, mixer_port, timeout_ms)
        detection = driver.audio_detection(mixer_ip, mixer_port, timeout_ms)
        info = driver.get_console_info(mixer_ip)
        firmware = info.get("firmware") or info.get("firmwareVersion")
        channel_count = info.get("channelCount")
        if channel_count is None:
            try:
                imported = driver.import_setup(mixer_ip, {"channelNames": True}, mixer_port, timeout_ms)
                channel_count = len(imported.channel_names or [])
            except Exception:  # noqa: BLE001
                channel_count = None
        scene = info.get("currentScene") or info.get("scene")
        signal_present = any(inp.get("signalPresent") for inp in (detection.get("inputs") or []))
        checks = health.get("checks") or []
        health_ok = all(c.get("ok") for c in checks) if checks else probe.success
        steps = [
            {"label": "Device opened", "ok": True},
            {"label": "Signal detected", "ok": signal_present},
            {"label": "Audio level", "ok": signal_present},
            {"label": "No clipping", "ok": not any(inp.get("clipping") for inp in (detection.get("inputs") or []))},
            {"label": "Ready for Service", "ok": health_ok and signal_present},
        ]
        if not signal_present:
            return {
                "success": False,
                "message": "No audio detected.",
                "guidance": "Speak into a microphone or play audio through the mixer, then test again.",
                "steps": steps,
                "health": health,
                "firmware": firmware,
                "channelCount": channel_count,
                "scene": scene,
            }
        return {
            "success": True,
            "message": "Mixer is ready for service.",
            "steps": steps,
            "health": health,
            "firmware": firmware,
            "channelCount": channel_count,
            "scene": scene,
        }

    device_index = device.get("deviceIndex")
    if device_index is None:
        return {"success": False, "message": "Select a discovered audio device before testing."}

    try:
        import sounddevice as sd  # type: ignore[import-untyped]
    except ImportError:
        return {
            "success": False,
            "message": "Audio testing requires the production agent with sounddevice installed.",
            "steps": [{"label": "Device opened", "ok": False}],
        }

    try:
        info = sd.query_devices(int(device_index))
        sample_rate = int(info.get("default_samplerate", 48000) or 48000)
        channels = min(int(info.get("max_input_channels", 1)), 2)
        sd.check_input_settings(device=int(device_index), samplerate=sample_rate, channels=channels)
        levels = _read_portaudio_levels(int(device_index), 300)
        signal_present = levels.get("signalPresent", False)
        steps = [
            {"label": "Device opened", "ok": True},
            {"label": "Signal detected", "ok": signal_present},
            {"label": "Audio level", "ok": signal_present},
            {"label": "No clipping", "ok": not levels.get("clipping", False)},
            {"label": "Ready for Service", "ok": signal_present and not levels.get("clipping", False)},
        ]
        if not signal_present:
            return {
                "success": False,
                "message": "No audio detected.",
                "guidance": "Check that your microphone or instrument is connected and not muted in Windows or macOS sound settings.",
                "steps": steps,
                "levels": levels,
                "sampleRate": sample_rate,
                "channels": channels,
            }
        return {
            "success": True,
            "message": "Audio input is ready for service.",
            "steps": steps,
            "levels": levels,
            "sampleRate": sample_rate,
            "channels": channels,
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "success": False,
            "message": str(exc),
            "steps": [{"label": "Device opened", "ok": False}],
        }


def agent_health() -> dict[str, Any]:
    portaudio_ok = False
    ffmpeg_ok = False
    try:
        import sounddevice as sd  # type: ignore[import-untyped]

        sd.query_devices()
        portaudio_ok = True
    except Exception:  # noqa: BLE001
        portaudio_ok = False
    _, ffmpeg_out = _run_command(["ffmpeg", "-version"], timeout=3)
    ffmpeg_ok = "ffmpeg version" in ffmpeg_out.lower()
    online = portaudio_ok or ffmpeg_ok
    return {
        "online": online,
        "portaudioAvailable": portaudio_ok,
        "ffmpegAvailable": ffmpeg_ok,
        "message": "Production audio agent is online." if online else "Audio agent is offline. Install sounddevice/FFmpeg on this computer.",
    }
