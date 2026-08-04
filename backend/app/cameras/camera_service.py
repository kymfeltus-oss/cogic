from __future__ import annotations

import ipaddress
import platform
import re
import socket
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from urllib.parse import urlparse


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


def _local_ipv4() -> str | None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return None


def _parse_dshow_devices(output: str) -> list[dict[str, Any]]:
    devices: list[dict[str, Any]] = []
    in_video = False
    index = 0
    for line in output.splitlines():
        if "DirectShow video devices" in line:
            in_video = True
            continue
        if in_video and "DirectShow audio devices" in line:
            break
        match = re.search(r'\"([^\"]+)\"', line)
        if in_video and match:
            label = match.group(1).strip()
            if not label:
                continue
            lower = label.lower()
            connection_type = "capture_card" if any(
                token in lower for token in ("capture", "elgato", "blackmagic", "decklink", "avermedia", "magewell")
            ) else "usb"
            devices.append(
                {
                    "id": f"dshow:{index}:{label}",
                    "label": label,
                    "connectionType": connection_type,
                    "hardwareLabel": label,
                    "deviceIndex": index,
                    "manufacturer": None,
                    "model": None,
                    "networkUrl": None,
                    "source": "agent_dshow",
                }
            )
            index += 1
    return devices


def _parse_v4l2_devices(output: str) -> list[dict[str, Any]]:
    devices: list[dict[str, Any]] = []
    current_name: str | None = None
    index = 0
    for line in output.splitlines():
        if not line.startswith("\t") and line.strip():
            current_name = line.strip().rstrip(":")
            continue
        if current_name and "/dev/video" in line:
            devices.append(
                {
                    "id": f"v4l2:{index}:{current_name}",
                    "label": current_name,
                    "connectionType": "capture_card" if "capture" in current_name.lower() else "usb",
                    "hardwareLabel": current_name,
                    "deviceIndex": index,
                    "manufacturer": None,
                    "model": None,
                    "networkUrl": None,
                    "source": "agent_v4l2",
                }
            )
            index += 1
    return devices


def discover_local_devices() -> list[dict[str, Any]]:
    system = platform.system().lower()
    if system == "windows":
        code, output = _run_command(
            ["ffmpeg", "-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"],
            timeout=15.0,
        )
        if code == 0 or "DirectShow" in output:
            parsed = _parse_dshow_devices(output)
            if parsed:
                return parsed
    elif system == "linux":
        code, output = _run_command(["v4l2-ctl", "--list-devices"], timeout=10.0)
        if code == 0:
            parsed = _parse_v4l2_devices(output)
            if parsed:
                return parsed
        # Fallback: probe /dev/video*
        import glob

        devices: list[dict[str, Any]] = []
        for idx, path in enumerate(sorted(glob.glob("/dev/video*"))):
            devices.append(
                {
                    "id": f"v4l2:{idx}:{path}",
                    "label": path,
                    "connectionType": "usb",
                    "hardwareLabel": path,
                    "deviceIndex": idx,
                    "manufacturer": None,
                    "model": None,
                    "networkUrl": None,
                    "source": "agent_v4l2",
                }
            )
        if devices:
            return devices
    return []


def _probe_rtsp_host(ip: str, port: int = 554, timeout: float = 0.35) -> bool:
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return True
    except OSError:
        return False


def scan_network_cameras(max_hosts: int = 64) -> list[dict[str, Any]]:
    local_ip = _local_ipv4()
    if not local_ip:
        return []

    network = ipaddress.ip_network(f"{local_ip}/24", strict=False)
    hosts = [str(host) for host in list(network.hosts())[:max_hosts]]

    found: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=32) as pool:
        futures = {pool.submit(_probe_rtsp_host, host): host for host in hosts}
        for future in as_completed(futures):
            host = futures[future]
            try:
                if future.result():
                    found.append(
                        {
                            "id": f"network:{host}:554",
                            "label": f"Network camera at {host}",
                            "connectionType": "network",
                            "hardwareLabel": host,
                            "deviceIndex": None,
                            "manufacturer": None,
                            "model": None,
                            "networkUrl": f"rtsp://{host}:554/",
                            "source": "agent_scan",
                        }
                    )
            except Exception:
                pass
    return found


def discover_cameras() -> dict[str, Any]:
    local = discover_local_devices()
    network = scan_network_cameras()
    devices = local + network
    ffmpeg_ok = _run_command(["ffmpeg", "-version"], timeout=5.0)[0] == 0
    if not devices and not ffmpeg_ok:
        return {
            "devices": [],
            "agentAvailable": True,
            "message": "No cameras found. Install FFmpeg on this production machine to scan USB and capture devices.",
        }
    if not devices:
        return {
            "devices": [],
            "agentAvailable": True,
            "message": "No cameras detected on this production machine or local network.",
        }
    return {
        "devices": devices,
        "agentAvailable": True,
        "message": f"Found {len(devices)} camera(s).",
    }


def test_device(
    connection_type: str,
    device_index: int | None = None,
    hardware_label: str | None = None,
    network_url: str | None = None,
    network_username: str | None = None,
    network_password: str | None = None,
) -> dict[str, Any]:
    started = time.time()

    if connection_type == "network":
        if not network_url:
            return {"success": False, "message": "Network camera address is missing.", "latencyMs": None}
        parsed = urlparse(network_url)
        host = parsed.hostname
        port = parsed.port or (554 if parsed.scheme == "rtsp" else 80)
        if not host:
            return {"success": False, "message": "Network camera address is invalid.", "latencyMs": None}
        if not _probe_rtsp_host(host, port):
            return {
                "success": False,
                "message": f"We couldn't reach the camera at {host}. Check power, network cable, and IP address.",
                "latencyMs": None,
            }
        latency = round((time.time() - started) * 1000, 1)
        return {"success": True, "message": "Network camera is reachable.", "latencyMs": latency}

    label = hardware_label or ""
    system = platform.system().lower()
    if system == "windows" and label:
        code, output = _run_command(
            [
                "ffmpeg",
                "-hide_banner",
                "-f",
                "dshow",
                "-i",
                f"video={label}",
                "-frames:v",
                "1",
                "-f",
                "null",
                "-",
            ],
            timeout=10.0,
        )
        if code == 0:
            latency = round((time.time() - started) * 1000, 1)
            return {"success": True, "message": "Camera is responding.", "latencyMs": latency}
        return {
            "success": False,
            "message": "We couldn't open this camera. Unplug and reconnect it, then try again.",
            "latencyMs": None,
        }

    if system == "linux" and device_index is not None:
        code, _ = _run_command(
            [
                "ffmpeg",
                "-hide_banner",
                "-f",
                "v4l2",
                "-i",
                f"/dev/video{device_index}",
                "-frames:v",
                "1",
                "-f",
                "null",
                "-",
            ],
            timeout=10.0,
        )
        if code == 0:
            latency = round((time.time() - started) * 1000, 1)
            return {"success": True, "message": "Camera is responding.", "latencyMs": latency}

    return {
        "success": False,
        "message": "Camera test requires FFmpeg on the production machine, or use browser preview for USB cameras.",
        "latencyMs": None,
    }


def health() -> dict[str, Any]:
    ffmpeg_ok = _run_command(["ffmpeg", "-version"], timeout=5.0)[0] == 0
    return {
        "online": True,
        "ffmpegAvailable": ffmpeg_ok,
        "message": "Camera discovery agent online." if ffmpeg_ok else "Camera agent online — install FFmpeg for hardware scans.",
    }
