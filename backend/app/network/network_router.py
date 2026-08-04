from fastapi import APIRouter, Header, HTTPException

from app.network.network_schemas import (
    NetworkDetectResponse,
    SpeedTestResponse,
    WiFiConnectRequest,
    WiFiConnectResponse,
    WiFiScanResponse,
)
from app.network import network_service
from app.config import settings

router = APIRouter(prefix="/network", tags=["network"])


def _verify_token(token: str | None) -> None:
    if settings.audio_service_token and token != settings.audio_service_token:
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/detect", response_model=NetworkDetectResponse)
def detect(x_internal_token: str | None = Header(default=None)) -> NetworkDetectResponse:
    _verify_token(x_internal_token)
    return NetworkDetectResponse(**network_service.detect_network())


@router.get("/wifi/scan", response_model=WiFiScanResponse)
def wifi_scan(x_internal_token: str | None = Header(default=None)) -> WiFiScanResponse:
    _verify_token(x_internal_token)
    return WiFiScanResponse(networks=network_service.scan_wifi_networks())


@router.post("/wifi/connect", response_model=WiFiConnectResponse)
def wifi_connect(
    body: WiFiConnectRequest,
    x_internal_token: str | None = Header(default=None),
) -> WiFiConnectResponse:
    _verify_token(x_internal_token)
    success, message = network_service.connect_wifi(body.ssid, body.password)
    return WiFiConnectResponse(success=success, message=message)


@router.post("/wifi/reconnect", response_model=WiFiConnectResponse)
def wifi_reconnect(
    body: WiFiConnectRequest,
    x_internal_token: str | None = Header(default=None),
) -> WiFiConnectResponse:
    _verify_token(x_internal_token)
    success, message = network_service.reconnect_wifi(body.ssid)
    return WiFiConnectResponse(success=success, message=message)


@router.post("/speed-test", response_model=SpeedTestResponse)
def speed_test(x_internal_token: str | None = Header(default=None)) -> SpeedTestResponse:
    _verify_token(x_internal_token)
    return SpeedTestResponse(**network_service.run_speed_test())
