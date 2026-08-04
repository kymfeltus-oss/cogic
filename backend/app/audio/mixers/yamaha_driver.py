from __future__ import annotations

from app.audio.mixers.base_driver import ImportedSetup, MixerDriver, MixerProbeResult


class YamahaDriver(MixerDriver):
    mixer_type = "yamaha"
    manufacturer = "Yamaha"
    model_name = "CL / QL / TF"

    def test_connection(self, ip: str, port: int = 10023, timeout_ms: int = 2000, retry_count: int = 1) -> MixerProbeResult:
        return MixerProbeResult(
            success=False,
            status="unavailable",
            ip_address=ip,
            message=f"{self.manufacturer} driver support is coming soon.",
        )

    def scan_network(self, hint_ips: list[str] | None = None, port: int = 10023, timeout_ms: int = 1500) -> list:
        return []

    def get_console_info(self, ip: str, port: int = 10023, timeout_ms: int = 2000) -> dict:
        return {"ok": False, "message": "Yamaha support is coming soon."}

    def import_setup(self, ip: str, options: dict[str, bool], port: int = 10023, timeout_ms: int = 3000) -> ImportedSetup:
        return ImportedSetup()

    def health_check(self, ip: str, port: int = 10023, timeout_ms: int = 2000) -> dict:
        return {"success": False, "message": "Yamaha support is coming soon.", "checks": [], "warnings": []}

    def audio_detection(self, ip: str, port: int = 10023, timeout_ms: int = 3000) -> dict:
        return {"success": False, "message": "Yamaha support is coming soon.", "inputs": [], "noSignalDetected": True}
