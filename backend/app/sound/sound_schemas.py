from __future__ import annotations

from pydantic import BaseModel, Field


class SoundDeviceRef(BaseModel):
    id: str
    deviceIndex: int | None = None
    hardwareLabel: str | None = None
    connectionType: str = "usb"
    browserDeviceId: str | None = None
    mixerType: str | None = None
    mixerIp: str | None = None
    source: str = "agent"


class SoundLevelsBody(BaseModel):
    device: SoundDeviceRef
    durationMs: int = Field(default=150, ge=50, le=500)


class SoundTestBody(BaseModel):
    device: SoundDeviceRef
    mixerPort: int = 10023
    timeoutMs: int = 3000


class SoundDiscoverBody(BaseModel):
    mixerType: str = "behringer_x32"
    hintIps: list[str] = Field(default_factory=list)


class SoundDevicePersistBody(BaseModel):
    """Canonical fields persisted on sound_items (Next.js / Supabase)."""

    device_id: str | None = None
    device_name: str
    device_label: str | None = None
    connection_type: str = "unknown"
    device_type: str = "microphone"
    sample_rate: int | None = None
    channel_count: int | None = None
    signal_present: bool = False
    peak_level: float | None = None
    average_level: float | None = None
    clipping_detected: bool = False
    status: str = "not_connected"
    last_tested_at: str | None = None
