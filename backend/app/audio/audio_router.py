from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException

from app.audio.audio_schemas import FeedbackNotchRequest, SettingsPatch
from app.audio.audio_service import audio_service
from app.config import settings

router = APIRouter(prefix="/api/v1/audio", tags=["audio"])


def _verify_token(token: str | None) -> None:
    if not token or token != settings.audio_service_token:
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/status")
def get_status(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return audio_service.build_status()


@router.post("/x32/connect")
def connect_x32(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return audio_service.connect()


@router.post("/x32/disconnect")
def disconnect_x32(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return audio_service.disconnect()


@router.post("/x32/test")
def test_x32(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return audio_service.test_connection()


@router.get("/x32/state")
def x32_state(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return audio_service.x32.console_state()


@router.post("/x32/refresh")
def refresh_x32(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    audio_service.x32.refresh_state()
    return audio_service.x32.console_state()


@router.get("/channels")
def list_channels(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return {"channels": audio_service.build_channels()}


@router.post("/channels/{channel_id}/mute")
def mute_channel(channel_id: int, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    audio_service.mute_channel(channel_id)
    return {"ok": True}


@router.post("/channels/{channel_id}/unmute")
def unmute_channel(channel_id: int, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    audio_service.unmute_channel(channel_id)
    return {"ok": True}


@router.post("/channels/{channel_id}/solo")
def solo_channel(channel_id: int, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    audio_service.solo_channel(channel_id)
    return {"ok": True}


@router.post("/channels/{channel_id}/unsolo")
def unsolo_channel(channel_id: int, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    audio_service.unsolo_channel(channel_id)
    return {"ok": True}


@router.get("/buses")
def list_buses(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return {"buses": audio_service.build_buses()}


@router.post("/buses/{bus_key}/mute")
def mute_bus(bus_key: str, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    bus = next((b for b in audio_service.x32.buses() if b.key == bus_key), None)
    if bus:
        bus.muted = True
    return {"ok": True}


@router.post("/buses/{bus_key}/unmute")
def unmute_bus(bus_key: str, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    bus = next((b for b in audio_service.x32.buses() if b.key == bus_key), None)
    if bus:
        bus.muted = False
    return {"ok": True}


@router.get("/health")
def get_health(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return audio_service.build_health()


@router.post("/health/run")
def run_health(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return audio_service.build_health()


@router.get("/loudness")
def get_loudness(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return audio_service.build_loudness()


@router.get("/delay")
def get_delay(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return audio_service._delay


@router.post("/delay/check")
def delay_check(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return audio_service.run_delay_check()


@router.post("/delay/apply-correction")
def delay_correction(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return audio_service.apply_delay_correction()


@router.get("/feedback")
def get_feedback(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return audio_service.build_feedback()


@router.post("/feedback/apply-notch")
def apply_notch(body: FeedbackNotchRequest, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    audio_service.apply_notch(body.frequencyHz, body.channel)
    return {"ok": True}


@router.get("/live/snapshot")
def live_snapshot(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return audio_service.build_live_payload()


@router.patch("/runtime/settings")
def patch_runtime_settings(body: SettingsPatch, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    audio_service.update_settings(body.model_dump(exclude_none=True))
    return {"ok": True}


@router.post("/runtime/mappings")
def patch_runtime_mappings(body: list[dict], x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    audio_service.update_mappings(body)
    return {"ok": True}


@router.post("/scenes/{scene_id}/recall")
def recall_scene(scene_id: int, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    audio_service.recall_scene(scene_id)
    return {"ok": True}


@router.get("/scenes")
def list_scenes(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    state = audio_service.x32.console_state()
    scenes = []
    for index in range(1, 101):
        scenes.append(
            {
                "index": index,
                "name": state.get("currentScene") if state.get("currentSceneIndex") == index else f"Scene {index}",
                "productionScene": None,
                "mapped": False,
            }
        )
    if state.get("currentSceneIndex"):
        idx = state["currentSceneIndex"]
        if 1 <= idx <= len(scenes):
            scenes[idx - 1]["name"] = state.get("currentScene") or f"Scene {idx}"
    return {"scenes": scenes[:20]}
