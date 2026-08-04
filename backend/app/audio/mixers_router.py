from __future__ import annotations

import logging

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.audio.mixers.registry import get_mixer_driver
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/mixers", tags=["mixers"])


def _verify_token(token: str | None) -> None:
    if not token or token != settings.audio_service_token:
        raise HTTPException(status_code=401, detail="Unauthorized")


class MixerConnectionBody(BaseModel):
    ip: str = Field(min_length=1)
    mixerType: str = "behringer_x32"
    port: int = 10023
    timeoutMs: int = 2000
    retryCount: int = 1


class MixerScanBody(BaseModel):
    mixerType: str = "behringer_x32"
    hintIps: list[str] = Field(default_factory=list)
    port: int = 10023
    timeoutMs: int = 1500


class MixerImportBody(BaseModel):
    ip: str = Field(min_length=1)
    mixerType: str = "behringer_x32"
    options: dict[str, bool] = Field(default_factory=dict)
    port: int = 10023
    timeoutMs: int = 3000


@router.post("/test")
def test_mixer(body: MixerConnectionBody, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    driver = get_mixer_driver(body.mixerType)
    result = driver.test_connection(body.ip, body.port, body.timeoutMs, body.retryCount)
    if result.technical_error:
        logger.warning("Mixer test technical error for %s: %s", body.ip, result.technical_error)
    payload = result.to_dict()
    payload["success"] = result.success
    return payload


@router.post("/scan")
def scan_mixers(body: MixerScanBody, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    driver = get_mixer_driver(body.mixerType)
    found = driver.scan_network(body.hintIps, body.port, body.timeoutMs)
    return {
        "success": len(found) > 0,
        "status": "found_one" if len(found) == 1 else "found_many" if found else "none",
        "message": "Scan complete.",
        "mixers": found,
    }


@router.post("/connect")
def connect_mixer(body: MixerConnectionBody, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    driver = get_mixer_driver(body.mixerType)
    result = driver.test_connection(body.ip, body.port, body.timeoutMs, body.retryCount)
    if result.technical_error:
        logger.warning("Mixer connect technical error for %s: %s", body.ip, result.technical_error)
    return {
        "success": result.success,
        "connected": result.success,
        "status": result.status,
        "message": result.message,
        "summary": result.to_dict(),
    }


@router.post("/import")
def import_mixer_setup(body: MixerImportBody, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    driver = get_mixer_driver(body.mixerType)
    setup = driver.import_setup(body.ip, body.options, body.port, body.timeoutMs)
    return {"success": True, "message": "Mixer setup imported.", "setup": setup.to_dict()}


@router.post("/health-check")
def mixer_health_check(body: MixerConnectionBody, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    driver = get_mixer_driver(body.mixerType)
    return driver.health_check(body.ip, body.port, body.timeoutMs)


@router.post("/audio-detection")
def mixer_audio_detection(body: MixerConnectionBody, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    driver = get_mixer_driver(body.mixerType)
    return driver.audio_detection(body.ip, body.port, body.timeoutMs)


@router.get("/info")
def mixer_info(
    ip: str,
    mixerType: str = "behringer_x32",
    x_internal_token: str | None = Header(default=None),
):
    _verify_token(x_internal_token)
    driver = get_mixer_driver(mixerType)
    return driver.get_console_info(ip)
