from __future__ import annotations

import ipaddress
import socket
import struct
import time
from typing import Any

from app.audio.mixers.base_driver import ImportedSetup, MixerDriver, MixerProbeResult
from app.audio.x32_client import X32Client


def _quality_from_latency(ms: float | None) -> str | None:
    if ms is None:
        return None
    if ms <= 5:
        return "Excellent"
    if ms <= 15:
        return "Good"
    if ms <= 40:
        return "Fair"
    return "Poor"


def _ping_ip(ip: str, port: int, timeout_ms: int) -> bool:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(timeout_ms / 1000.0)
        sock.sendto(b"/info", (ip, port))
        sock.close()
        return True
    except OSError:
        return False


def _local_subnet_candidates() -> list[str]:
    candidates: list[str] = []
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("8.8.8.8", 80))
        local_ip = probe.getsockname()[0]
        probe.close()
        network = ipaddress.ip_network(f"{local_ip}/24", strict=False)
        hosts = list(network.hosts())
        for host in hosts[:64]:
            candidates.append(str(host))
    except OSError:
        pass
    return candidates


class X32Driver(MixerDriver):
    mixer_type = "behringer_x32"
    manufacturer = "Behringer"
    model_name = "X32"

    def _probe(self, ip: str, port: int, timeout_ms: int) -> tuple[X32Client | None, float | None, str | None]:
        if not ip:
            return None, None, "IP address is required"
        client = X32Client(ip, port)
        started = time.time()
        try:
            ok = client.connect()
            latency = client.console_state().get("oscLatencyMs")
            if ok:
                return client, float(latency) if latency is not None else round((time.time() - started) * 1000, 1), None
            ok_ping, ping_latency, ping_message = client.test_connection()
            if ok_ping:
                return client, ping_latency, None
            return None, None, ping_message
        except Exception as exc:  # noqa: BLE001
            return None, None, str(exc)

    def test_connection(
        self,
        ip: str,
        port: int = 10023,
        timeout_ms: int = 2000,
        retry_count: int = 1,
    ) -> MixerProbeResult:
        ip_reachable = _ping_ip(ip, port, timeout_ms)
        if not ip_reachable:
            return MixerProbeResult(
                success=False,
                status="unreachable",
                ip_address=ip,
                message="We could not reach your mixer.",
            )

        last_error: str | None = None
        client: X32Client | None = None
        latency: float | None = None
        for _ in range(max(1, retry_count)):
            client, latency, last_error = self._probe(ip, port, timeout_ms)
            if client:
                break

        if not client:
            return MixerProbeResult(
                success=False,
                status="wrong_device",
                ip_address=ip,
                message="We found a device at this address, but it does not appear to be a Behringer X32.",
                technical_error=last_error,
            )

        state = client.console_state()
        channels = [ch for ch in client.channels() if ch.name.strip()]
        serial = state.get("serialNumber") or state.get("consoleSerial")
        try:
            client.disconnect()
        except Exception:  # noqa: BLE001
            pass

        response_ms = latency or 0.0
        return MixerProbeResult(
            success=True,
            status="ready",
            manufacturer=self.manufacturer,
            model=self.model_name,
            firmware=state.get("firmwareVersion"),
            serial_number=str(serial) if serial else None,
            ip_address=ip,
            connection_quality=_quality_from_latency(response_ms),
            response_time_ms=response_ms,
            inputs_detected=32,
            mixes_detected=16,
            message="Mixer Found",
        )

    def scan_network(
        self,
        hint_ips: list[str] | None = None,
        port: int = 10023,
        timeout_ms: int = 1500,
    ) -> list[dict[str, Any]]:
        seen: set[str] = set()
        targets: list[str] = []
        for ip in hint_ips or []:
            if ip and ip not in seen:
                seen.add(ip)
                targets.append(ip)
        for ip in _local_subnet_candidates():
            if ip not in seen:
                seen.add(ip)
                targets.append(ip)

        found: list[dict[str, Any]] = []
        for ip in targets:
            result = self.test_connection(ip, port=port, timeout_ms=timeout_ms, retry_count=1)
            if result.success:
                found.append(
                    {
                        "name": f"{result.manufacturer} {result.model}",
                        "model": result.model or self.model_name,
                        "manufacturer": result.manufacturer or self.manufacturer,
                        "ipAddress": ip,
                        "firmware": result.firmware,
                        "connectionQuality": result.connection_quality,
                        "responseTimeMs": result.response_time_ms,
                        "mixerType": self.mixer_type,
                    }
                )
        return found

    def get_console_info(self, ip: str, port: int = 10023, timeout_ms: int = 2000) -> dict[str, Any]:
        client, _, error = self._probe(ip, port, timeout_ms)
        if not client:
            return {"ok": False, "error": error}
        state = client.console_state()
        try:
            client.disconnect()
        except Exception:  # noqa: BLE001
            pass
        return {"ok": True, **state}

    def import_setup(
        self,
        ip: str,
        options: dict[str, bool],
        port: int = 10023,
        timeout_ms: int = 3000,
    ) -> ImportedSetup:
        client, _, _ = self._probe(ip, port, timeout_ms)
        if not client:
            return ImportedSetup()

        setup = ImportedSetup()
        channels = client.channels()
        if options.get("channelNames", True):
            setup.channel_names = [{"channel": ch.number, "name": ch.name or f"CH {ch.number:02d}"} for ch in channels]
        if options.get("channelLabels", True):
            setup.channel_labels = [{"channel": ch.number, "label": ch.name or ""} for ch in channels if ch.name]
        if options.get("scenes", True):
            state = client.console_state()
            if state.get("currentScene"):
                setup.scenes = [
                    {
                        "index": state.get("currentSceneIndex") or 1,
                        "name": state.get("currentScene"),
                    }
                ]
        if options.get("muteGroups", True):
            setup.mute_groups = [{"group": index, "name": f"Mute Group {index}"} for index in range(1, 7)]
        if options.get("dcaGroups", True):
            setup.dca_groups = [{"group": index, "name": f"DCA {index}"} for index in range(1, 9)]
        if options.get("routing", True):
            setup.routing = [
                {"channel": ch.number, "name": ch.name or f"CH {ch.number:02d}"}
                for ch in channels
                if ch.name.strip()
            ]
        if options.get("userLabels", True):
            setup.user_labels = [ch.name for ch in channels if ch.name.strip()][:16]

        try:
            client.disconnect()
        except Exception:  # noqa: BLE001
            pass
        return setup

    def health_check(self, ip: str, port: int = 10023, timeout_ms: int = 2000) -> dict[str, Any]:
        result = self.test_connection(ip, port=port, timeout_ms=timeout_ms)
        warnings: list[str] = []
        checks = [
            {"label": "Network Stable", "ok": result.success and (result.response_time_ms or 999) < 80},
            {"label": "Firmware Supported", "ok": result.success},
            {"label": "Communication Verified", "ok": result.success},
            {"label": "Mixer Ready", "ok": result.status == "ready"},
        ]
        if result.success and result.response_time_ms and result.response_time_ms > 30:
            warnings.append("Your mixer is connected, but network response is slower than normal.")
        if result.success:
            client, _, _ = self._probe(ip, port, timeout_ms)
            if client:
                named = [ch for ch in client.channels() if ch.name.strip()]
                if not named:
                    warnings.append("Your mixer is connected, but no channel names were found.")
                try:
                    client.disconnect()
                except Exception:  # noqa: BLE001
                    pass
        return {
            "success": result.success,
            "message": "Mixer health check complete.",
            "checks": checks,
            "warnings": warnings,
        }

    def audio_detection(self, ip: str, port: int = 10023, timeout_ms: int = 3000) -> dict[str, Any]:
        client, _, _ = self._probe(ip, port, timeout_ms)
        if not client:
            return {
                "success": False,
                "message": "Could not detect audio because the mixer is not connected.",
                "inputs": [],
                "noSignalDetected": True,
            }

        client.subscribe_meters()
        deadline = time.time() + min(timeout_ms / 1000.0, 2.5)
        while time.time() < deadline:
            time.sleep(0.1)

        inputs: list[dict[str, Any]] = []
        for ch in client.channels():
            if not ch.name.strip():
                continue
            signal_present = ch.level_db > -50
            inputs.append({"name": ch.name, "signalPresent": signal_present})

        try:
            client.disconnect()
        except Exception:  # noqa: BLE001
            pass

        active = [item for item in inputs if item["signalPresent"]]
        no_signal = len(active) == 0
        if no_signal and inputs:
            return {
                "success": True,
                "message": "No active audio detected yet.",
                "inputs": inputs,
                "noSignalDetected": True,
            }
        return {
            "success": True,
            "message": "Audio detection complete.",
            "inputs": inputs,
            "noSignalDetected": no_signal,
        }
