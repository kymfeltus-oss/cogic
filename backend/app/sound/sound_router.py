from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException

from app.config import settings
from app.sound.sound_devices_service import agent_health, discover_audio_devices, read_device_levels, test_audio_device
from app.sound.sound_schemas import SoundDiscoverBody, SoundLevelsBody, SoundTestBody

router = APIRouter(prefix="/sound", tags=["sound-devices"])


def _verify_token(token: str | None) -> None:
    if not token or token != settings.audio_service_token:
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/health")
def sound_health(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return agent_health()


@router.post("/discover")
def sound_discover(body: SoundDiscoverBody, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return discover_audio_devices(body.mixerType, body.hintIps)


@router.post("/test-device")
def sound_test_device(body: SoundTestBody, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    payload = body.device.model_dump()
    result = test_audio_device(payload, body.mixerPort, body.timeoutMs)
    result["success"] = bool(result.get("success"))
    return result


@router.post("/levels")
def sound_levels(body: SoundLevelsBody, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    payload = body.device.model_dump()
    result = read_device_levels(payload, body.durationMs)
    result["success"] = bool(result.get("success", True) and "inputLevel" in result)
    return result
