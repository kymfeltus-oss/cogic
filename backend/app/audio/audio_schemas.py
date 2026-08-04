from pydantic import BaseModel, Field


class ConnectResponse(BaseModel):
    ok: bool
    message: str = ""


class TestConnectionResponse(BaseModel):
    ok: bool
    latencyMs: float | None = None
    message: str = ""


class ChannelMappingPatch(BaseModel):
    displayName: str | None = None
    roleKey: str | None = None
    wireless: bool | None = None
    wirelessChannel: str | None = None
    backupAvailable: bool | None = None
    groupKey: str | None = None
    thresholdDb: float | None = None


class SettingsPatch(BaseModel):
    x32Ip: str | None = None
    x32OscPort: int | None = None
    connectionTimeoutMs: int | None = None
    meterRefreshRateMs: int | None = None
    lufsTarget: float | None = None
    truePeakCeiling: float | None = None
    feedbackSensitivity: float | None = None
    wirelessBatteryWarningPct: int | None = None
    wirelessBatteryCriticalPct: int | None = None
    streamSilenceThresholdDb: float | None = None
    recordingSilenceThresholdDb: float | None = None
    autoCreateIncidents: bool | None = None
    autoApplySceneSnapshots: bool | None = None
    enableAutomationRules: bool | None = None
    enableHealthCheckBeforeGoLive: bool | None = None
    enableTalkbackControls: bool | None = None
    enableAuditLogging: bool | None = None
    consoleDisplayName: str | None = None


class FeedbackNotchRequest(BaseModel):
    frequencyHz: float = Field(gt=20, lt=20000)
    channel: int = Field(ge=1, le=32)


class SnapshotCreateRequest(BaseModel):
    name: str
    mappedScene: str | None = None
    description: str = ""
    payloadJson: dict = Field(default_factory=dict)


class SnapshotPatchRequest(BaseModel):
    name: str | None = None
    mappedScene: str | None = None
    description: str | None = None
    payloadJson: dict | None = None
    isPreshowDefault: bool | None = None
    isGoLiveDefault: bool | None = None
    status: str | None = None
