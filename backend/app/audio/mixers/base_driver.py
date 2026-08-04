from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class MixerProbeResult:
    success: bool
    status: str
    manufacturer: str | None = None
    model: str | None = None
    firmware: str | None = None
    serial_number: str | None = None
    ip_address: str = ""
    connection_quality: str | None = None
    response_time_ms: float | None = None
    inputs_detected: int | None = None
    mixes_detected: int | None = None
    message: str = ""
    technical_error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload.pop("technical_error", None)
        return payload


@dataclass
class ImportedSetup:
    channel_names: list[dict[str, Any]] = field(default_factory=list)
    channel_labels: list[dict[str, Any]] = field(default_factory=list)
    scenes: list[dict[str, Any]] = field(default_factory=list)
    mute_groups: list[dict[str, Any]] = field(default_factory=list)
    dca_groups: list[dict[str, Any]] = field(default_factory=list)
    routing: list[dict[str, Any]] = field(default_factory=list)
    user_labels: list[str] = field(default_factory=list)
    sound_sources: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class MixerDriver(ABC):
    mixer_type: str = "unknown"
    manufacturer: str = "Unknown"
    model_name: str = "Unknown"

    @abstractmethod
    def test_connection(
        self,
        ip: str,
        port: int = 10023,
        timeout_ms: int = 2000,
        retry_count: int = 1,
    ) -> MixerProbeResult: ...

    @abstractmethod
    def scan_network(
        self,
        hint_ips: list[str] | None = None,
        port: int = 10023,
        timeout_ms: int = 1500,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    def get_console_info(self, ip: str, port: int = 10023, timeout_ms: int = 2000) -> dict[str, Any]: ...

    @abstractmethod
    def import_setup(
        self,
        ip: str,
        options: dict[str, bool],
        port: int = 10023,
        timeout_ms: int = 3000,
    ) -> ImportedSetup: ...

    @abstractmethod
    def health_check(self, ip: str, port: int = 10023, timeout_ms: int = 2000) -> dict[str, Any]: ...

    @abstractmethod
    def audio_detection(self, ip: str, port: int = 10023, timeout_ms: int = 3000) -> dict[str, Any]: ...

    def import_configuration(self, ip: str, options: dict[str, bool], port: int = 10023, timeout_ms: int = 3000) -> ImportedSetup:
        return self.import_setup(ip, options, port, timeout_ms)

    def detect_audio(self, ip: str, port: int = 10023, timeout_ms: int = 3000) -> dict[str, Any]:
        return self.audio_detection(ip, port, timeout_ms)

    def run_health_check(self, ip: str, port: int = 10023, timeout_ms: int = 2000) -> dict[str, Any]:
        return self.health_check(ip, port, timeout_ms)
