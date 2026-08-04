from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.audio.audio_router import router as audio_router
from app.audio.audio_ws import router as ws_router
from app.audio.mixers_router import router as mixers_router
from app.audio.audio_service import audio_service
from app.network.network_router import router as network_router
from app.cameras.camera_router import router as cameras_router
from app.sound.sound_router import router as sound_devices_router
from app.streaming.streaming_router import router as streaming_router
from app.config import settings

app = FastAPI(title="Parable Audio Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(audio_router)
app.include_router(mixers_router)
app.include_router(ws_router)
app.include_router(network_router)
app.include_router(cameras_router)
app.include_router(streaming_router)
app.include_router(sound_devices_router)


@app.on_event("startup")
def startup() -> None:
    # #region agent log
    import json, time
    from pathlib import Path
    _log = Path(__file__).resolve().parents[2] / "debug-675ed0.log"
    try:
        with open(_log, "a", encoding="utf-8") as _f:
            _f.write(json.dumps({"sessionId": "675ed0", "runId": "post-fix", "hypothesisId": "H1", "location": "main.py:startup", "message": "streaming_router registered", "data": {"routes": [getattr(r, "path", str(r)) for r in app.routes if "streaming" in str(getattr(r, "path", ""))]}, "timestamp": int(time.time() * 1000)}) + "\n")
    except Exception:
        pass
    # #endregion
    if settings.x32_ip:
        audio_service.update_settings({"x32Ip": settings.x32_ip, "x32OscPort": settings.x32_osc_port})
        audio_service.connect()


@app.get("/health")
def health():
    return {"ok": True, "x32Online": audio_service.x32.is_online()}
