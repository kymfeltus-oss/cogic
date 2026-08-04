from fastapi import APIRouter, Header, HTTPException

from app.cameras import camera_service
from app.cameras.camera_schemas import DiscoverResponse, TestDeviceRequest, TestDeviceResponse
from app.config import settings

router = APIRouter(prefix="/cameras", tags=["cameras"])


def _verify_token(token: str | None) -> None:
    if settings.audio_service_token and token != settings.audio_service_token:
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/health")
def camera_health(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return camera_service.health()


@router.get("/discover", response_model=DiscoverResponse)
def discover(x_internal_token: str | None = Header(default=None)) -> DiscoverResponse:
    _verify_token(x_internal_token)
    raw = camera_service.discover_cameras()
    return DiscoverResponse(**raw)


@router.post("/test-device", response_model=TestDeviceResponse)
def test_device(body: TestDeviceRequest, x_internal_token: str | None = Header(default=None)) -> TestDeviceResponse:
    _verify_token(x_internal_token)
    raw = camera_service.test_device(
        connection_type=body.connection_type,
        device_index=body.device_index,
        hardware_label=body.hardware_label,
        network_url=body.network_url,
        network_username=body.network_username,
        network_password=body.network_password,
    )
    return TestDeviceResponse(**raw)
