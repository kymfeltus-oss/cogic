from pydantic import BaseModel, Field


class WiFiNetwork(BaseModel):
    ssid: str
    signal_strength: int | None = None
    secured: bool = True


class NetworkDetectResponse(BaseModel):
    online: bool
    connection_type: str | None = None  # wifi | ethernet | unknown
    ssid: str | None = None
    local_ip: str | None = None
    internet_reachable: bool = False
    ethernet_connected: bool | None = None
    agent_available: bool = True


class WiFiScanResponse(BaseModel):
    networks: list[WiFiNetwork]


class WiFiConnectRequest(BaseModel):
    ssid: str = Field(min_length=1)
    password: str = ""


class WiFiConnectResponse(BaseModel):
    success: bool
    message: str


class SpeedTestResponse(BaseModel):
    success: bool
    upload_mbps: float = 0
    download_mbps: float = 0
    latency_ms: float = 0
    stability_score: float = 0  # 0-100
    streaming_quality: str = "unknown"  # excellent | good | fair | poor | offline
    message: str = ""
