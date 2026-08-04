"""OS-level network detection for Parable local agent."""

from __future__ import annotations

import platform
import re
import socket
import statistics
import subprocess
import tempfile
import time
import xml.sax.saxutils as saxutils

import httpx

INTERNET_PROBE_URL = "https://www.cloudflare.com/cdn-cgi/trace"
DOWNLOAD_URL = "https://speed.cloudflare.com/__down?bytes=2500000"
UPLOAD_URL = "https://speed.cloudflare.com/__up"


def _run(cmd: list[str], timeout: float = 12.0) -> str:
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        return (result.stdout or "") + (result.stderr or "")
    except (subprocess.TimeoutExpired, OSError):
        return ""


def get_local_ip() -> str | None:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
        sock.close()
        return ip
    except OSError:
        return None


def probe_internet(timeout: float = 4.0) -> bool:
    try:
        response = httpx.get(INTERNET_PROBE_URL, timeout=timeout, follow_redirects=True)
        return response.status_code == 200
    except httpx.HTTPError:
        return False


def _parse_key_values(text: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in text.splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            values[key.strip().lower()] = value.strip()
    return values


def _windows_wifi_ssid() -> str | None:
    output = _run(["netsh", "wlan", "show", "interfaces"])
    match = re.search(r"^\s*SSID\s*:\s*(.+)$", output, re.MULTILINE)
    if not match:
        return None
    ssid = match.group(1).strip()
    if not ssid or ssid.lower() == "n/a":
        return None
    return ssid


def _windows_connection_type() -> tuple[str | None, bool | None]:
    output = _run(["netsh", "interface", "show", "interface"])
    ethernet_connected: bool | None = None
    has_wifi = False
    has_ethernet = False
    for line in output.splitlines():
        lower = line.lower()
        if "wi-fi" in lower or "wireless" in lower:
            if "connected" in lower:
                has_wifi = True
        if "ethernet" in lower:
            if "connected" in lower:
                has_ethernet = True
                ethernet_connected = True
            elif "disconnected" in lower:
                ethernet_connected = False
    if has_ethernet:
        return "ethernet", ethernet_connected
    if has_wifi:
        return "wifi", ethernet_connected
    return None, ethernet_connected


def _linux_wifi_ssid() -> str | None:
    output = _run(["nmcli", "-t", "-f", "ACTIVE,SSID", "dev", "wifi"])
    for line in output.splitlines():
        parts = line.split(":")
        if len(parts) >= 2 and parts[0] == "yes":
            ssid = parts[1].strip()
            return ssid or None
    return None


def _linux_connection_type() -> tuple[str | None, bool | None]:
    output = _run(["nmcli", "-t", "-f", "TYPE,STATE", "device"])
    has_wifi = False
    has_ethernet = False
    ethernet_connected: bool | None = None
    for line in output.splitlines():
        parts = line.split(":")
        if len(parts) < 2:
            continue
        dev_type, state = parts[0].lower(), parts[1].lower()
        if dev_type == "wifi" and state == "connected":
            has_wifi = True
        if dev_type == "ethernet":
            if state == "connected":
                has_ethernet = True
                ethernet_connected = True
            elif state in {"disconnected", "unavailable"}:
                ethernet_connected = False
    if has_ethernet:
        return "ethernet", ethernet_connected
    if has_wifi:
        return "wifi", ethernet_connected
    return None, ethernet_connected


def detect_network() -> dict:
    local_ip = get_local_ip()
    internet_reachable = probe_internet()
    system = platform.system().lower()

    connection_type: str | None = None
    ssid: str | None = None
    ethernet_connected: bool | None = None

    if system == "windows":
        connection_type, ethernet_connected = _windows_connection_type()
        ssid = _windows_wifi_ssid() if connection_type == "wifi" else None
    elif system == "linux":
        connection_type, ethernet_connected = _linux_connection_type()
        ssid = _linux_wifi_ssid() if connection_type == "wifi" else None
    else:
        connection_type = "unknown"

    online = bool(local_ip) and internet_reachable

    return {
        "online": online,
        "connection_type": connection_type,
        "ssid": ssid,
        "local_ip": local_ip,
        "internet_reachable": internet_reachable,
        "ethernet_connected": ethernet_connected,
        "agent_available": True,
    }


def _parse_windows_wifi_networks(output: str) -> list[dict]:
    networks: list[dict] = []
    current: dict | None = None
    for raw in output.splitlines():
        line = raw.strip()
        if line.startswith("SSID "):
            if current and current.get("ssid"):
                networks.append(current)
            ssid = line.split(":", 1)[1].strip()
            current = {"ssid": ssid, "signal_strength": None, "secured": True}
        elif current is not None:
            if line.startswith("Signal"):
                match = re.search(r"(\d+)%", line)
                if match:
                    current["signal_strength"] = int(match.group(1))
            if "Authentication" in line and "Open" in line:
                current["secured"] = False
    if current and current.get("ssid"):
        networks.append(current)

    deduped: dict[str, dict] = {}
    for net in networks:
        ssid = net["ssid"]
        if ssid not in deduped or (net.get("signal_strength") or 0) > (deduped[ssid].get("signal_strength") or 0):
            deduped[ssid] = net
    return list(deduped.values())


def scan_wifi_networks() -> list[dict]:
    system = platform.system().lower()
    if system == "windows":
        output = _run(["netsh", "wlan", "show", "networks", "mode=bssid"])
        return _parse_windows_wifi_networks(output)
    if system == "linux":
        output = _run(["nmcli", "-t", "-f", "SSID,SIGNAL,SECURITY", "dev", "wifi", "list"])
        networks: list[dict] = []
        for line in output.splitlines():
            parts = line.split(":")
            if len(parts) < 2:
                continue
            ssid = parts[0].strip()
            if not ssid:
                continue
            signal = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else None
            security = parts[2] if len(parts) > 2 else ""
            networks.append(
                {
                    "ssid": ssid,
                    "signal_strength": signal,
                    "secured": security.lower() not in {"", "--", "open"},
                }
            )
        return networks
    return []


def _windows_wifi_profile_xml(ssid: str, password: str) -> str:
    safe_ssid = saxutils.escape(ssid)
    safe_password = saxutils.escape(password)
    return f"""<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>{safe_ssid}</name>
  <SSIDConfig><SSID><name>{safe_ssid}</name></SSID></SSIDConfig>
  <connectionType>ESS</connectionType>
  <connectionMode>auto</connectionMode>
  <MSM><security>
    <authEncryption>
      <authentication>WPA2PSK</authentication>
      <encryption>AES</encryption>
      <useOneX>false</useOneX>
    </authEncryption>
    <sharedKey>
      <keyType>passPhrase</keyType>
      <protected>false</protected>
      <keyMaterial>{safe_password}</keyMaterial>
    </sharedKey>
  </security></MSM>
</WLANProfile>"""


def connect_wifi(ssid: str, password: str) -> tuple[bool, str]:
    system = platform.system().lower()
    if system == "windows":
        with tempfile.NamedTemporaryFile("w", suffix=".xml", delete=False, encoding="utf-8") as handle:
            handle.write(_windows_wifi_profile_xml(ssid, password))
            profile_path = handle.name
        _run(["netsh", "wlan", "delete", "profile", f"name={ssid}"])
        add_output = _run(["netsh", "wlan", "add", "profile", f"filename={profile_path}"])
        connect_output = _run(["netsh", "wlan", "connect", f"name={ssid}"])
        time.sleep(3)
        current = _windows_wifi_ssid()
        if current == ssid and probe_internet():
            return True, f"Connected to {ssid}."
        if current == ssid:
            return True, f"Connected to {ssid}. Checking internet..."
        detail = connect_output.strip() or add_output.strip()
        return False, detail or f"Could not connect to {ssid}."
    if system == "linux":
        cmd = ["nmcli", "dev", "wifi", "connect", ssid]
        if password:
            cmd += ["password", password]
        output = _run(cmd)
        time.sleep(3)
        if _linux_wifi_ssid() == ssid:
            return True, f"Connected to {ssid}."
        return False, output.strip() or f"Could not connect to {ssid}."
    return False, "Wi-Fi setup is not supported on this computer yet."


def reconnect_wifi(ssid: str) -> tuple[bool, str]:
    system = platform.system().lower()
    if system == "windows":
        output = _run(["netsh", "wlan", "connect", f"name={ssid}", f"ssid={ssid}"])
        time.sleep(2)
        if _windows_wifi_ssid() == ssid:
            return True, f"Reconnected to {ssid}."
        return False, output.strip() or f"Could not reconnect to {ssid}."
    if system == "linux":
        output = _run(["nmcli", "connection", "up", ssid])
        time.sleep(2)
        if _linux_wifi_ssid() == ssid:
            return True, f"Reconnected to {ssid}."
        return False, output.strip() or f"Could not reconnect to {ssid}."
    return False, "Automatic reconnect is not supported on this computer."


def _streaming_quality(upload_mbps: float, download_mbps: float, latency_ms: float, stability: float) -> str:
    if upload_mbps <= 0 or download_mbps <= 0:
        return "offline"
    if upload_mbps >= 10 and download_mbps >= 25 and latency_ms <= 80 and stability >= 70:
        return "excellent"
    if upload_mbps >= 5 and download_mbps >= 10 and latency_ms <= 120 and stability >= 50:
        return "good"
    if upload_mbps >= 2 and download_mbps >= 5:
        return "fair"
    return "poor"


def run_speed_test() -> dict:
    latency_samples: list[float] = []

    for _ in range(5):
        start = time.perf_counter()
        try:
            response = httpx.get(INTERNET_PROBE_URL, timeout=4.0)
            if response.status_code == 200:
                latency_samples.append((time.perf_counter() - start) * 1000)
        except httpx.HTTPError:
            pass
        time.sleep(0.15)

    latency_ms = statistics.mean(latency_samples) if latency_samples else 0.0
    jitter = statistics.pstdev(latency_samples) if len(latency_samples) > 1 else latency_ms
    stability_score = max(0.0, min(100.0, 100.0 - jitter * 2))

    download_mbps = 0.0
    try:
        start = time.perf_counter()
        response = httpx.get(DOWNLOAD_URL, timeout=15.0)
        elapsed = max(time.perf_counter() - start, 0.001)
        download_mbps = (len(response.content) * 8) / elapsed / 1_000_000
    except httpx.HTTPError:
        pass

    upload_mbps = 0.0
    payload = b"x" * 500_000
    try:
        start = time.perf_counter()
        response = httpx.post(UPLOAD_URL, content=payload, timeout=15.0)
        elapsed = max(time.perf_counter() - start, 0.001)
        if response.status_code < 400:
            upload_mbps = (len(payload) * 8) / elapsed / 1_000_000
    except httpx.HTTPError:
        pass

    quality = _streaming_quality(upload_mbps, download_mbps, latency_ms, stability_score)
    success = upload_mbps > 0 and download_mbps > 0
    packet_loss_percent = 0.0
    if latency_samples:
        failed = 5 - len(latency_samples)
        packet_loss_percent = round((failed / 5) * 100, 1)

    return {
        "success": success,
        "upload_mbps": round(upload_mbps, 1),
        "download_mbps": round(download_mbps, 1),
        "latency_ms": round(latency_ms, 0),
        "jitter_ms": round(jitter, 1),
        "packet_loss_percent": packet_loss_percent,
        "stability_score": round(stability_score, 0),
        "streaming_quality": quality,
        "message": "Speed test complete." if success else "Could not complete speed test.",
    }
