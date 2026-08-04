from pydantic import BaseModel


class DiscoveredCamera(BaseModel):
    id: str
    label: str
    connectionType: str
    hardwareLabel: str | None = None
    deviceIndex: int | None = None
    manufacturer: str | None = None
    model: str | None = None
    networkUrl: str | None = None
    source: str


class DiscoverResponse(BaseModel):
    devices: list[DiscoveredCamera]
    agentAvailable: bool
    message: str


class TestDeviceRequest(BaseModel):
    connection_type: str
    device_index: int | None = None
    hardware_label: str | None = None
    network_url: str | None = None
    network_username: str | None = None
    network_password: str | None = None


class TestDeviceResponse(BaseModel):
    success: bool
    message: str
    latencyMs: float | None = None
