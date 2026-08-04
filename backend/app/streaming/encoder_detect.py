from __future__ import annotations

import os
import platform
import shutil
import subprocess
from typing import Any


def _run(cmd: list[str], timeout: float = 5.0) -> str:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=False)
        return (result.stdout or "") + (result.stderr or "")
    except (OSError, subprocess.TimeoutExpired):
        return ""


def detect_encoders() -> dict[str, Any]:
    detected: list[str] = []
    gpu_name: str | None = None
    cpu_name = platform.processor() or platform.machine()
    av1_supported = False

    if shutil.which("nvidia-smi"):
        output = _run(["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"])
        if output.strip():
            gpu_name = output.strip().splitlines()[0].strip()
            detected.append("nvenc")
            av1_output = _run(["nvidia-smi", "--query-gpu=driver_version", "--format=csv,noheader"])
            if av1_output.strip():
                av1_supported = True

    system = platform.system().lower()
    if system == "windows":
        wmic = _run(["wmic", "cpu", "get", "name"])
        for line in wmic.splitlines():
            line = line.strip()
            if line and line.lower() != "name":
                cpu_name = line
                break
        dx = _run(["wmic", "path", "win32_VideoController", "get", "name"])
        if "intel" in dx.lower():
            detected.append("quicksync")
        if "amd" in dx.lower() or "radeon" in dx.lower():
            detected.append("amf")
    elif system == "linux":
        lspci = _run(["lspci"])
        if "vga" in lspci.lower() and "intel" in lspci.lower():
            detected.append("quicksync")
        if "amd" in lspci.lower() or "radeon" in lspci.lower():
            detected.append("amf")

    detected.append("x264")
    unique = []
    for enc in detected:
        if enc not in unique:
            unique.append(enc)

    recommended = unique[0] if unique else "x264"
    for pref in ("nvenc", "quicksync", "amf", "x264"):
        if pref in unique:
            recommended = pref
            break

    return {
        "detectedEncoders": unique,
        "recommended": recommended,
        "gpuName": gpu_name,
        "cpuName": cpu_name or None,
        "av1Supported": av1_supported,
    }
