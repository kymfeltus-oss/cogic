from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.audio.audio_service import audio_service

router = APIRouter()


@router.websocket("/ws/live")
async def audio_live_ws(websocket: WebSocket):
    await websocket.accept()
    pubsub = audio_service.redis.pubsub()
    channel = audio_service.store._key("live")
    pubsub.subscribe(channel)

    try:
        await websocket.send_json({"type": "snapshot", "payload": audio_service.build_live_payload()})
        while True:
            message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message and message.get("data"):
                await websocket.send_text(message["data"])
            else:
                await asyncio.sleep(max(audio_service._settings.get("meterRefreshRateMs", 100) / 1000, 0.05))
                await websocket.send_json({"type": "snapshot", "payload": audio_service.build_live_payload()})
    except WebSocketDisconnect:
        pass
    finally:
        pubsub.close()
