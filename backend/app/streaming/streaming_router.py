from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.streaming.encoder_service import encoder_service
from app.streaming.encoder_detect import detect_encoders
from app.streaming.providers.base_provider import ProviderNotConfiguredError
from app.streaming.providers.registry import get_provider, provider_configured

router = APIRouter(prefix="/streaming", tags=["streaming"])


def _verify_token(token: str | None) -> None:
    if settings.audio_service_token and token != settings.audio_service_token:
        raise HTTPException(status_code=401, detail="Unauthorized")


class OAuthStartBody(BaseModel):
    state: str
    redirect_uri: str


class OAuthCallbackBody(BaseModel):
    code: str
    redirect_uri: str


class OAuthRefreshBody(BaseModel):
    refresh_token: str


class TestConnectionBody(BaseModel):
    access_token: str | None = None
    refresh_token: str | None = None
    token_expires_at: str | None = None
    stream_url: str | None = None
    stream_key: str | None = None
    settings: dict | None = None
    video_profile: dict | None = None
    audio_profile: dict | None = None
    privacy: str | None = None
    scheduled_start_at: str | None = None
    developer_mode: bool = False


class BroadcastBody(BaseModel):
    access_token: str = ""
    title: str = ""
    description: str = ""
    broadcast_id: str | None = None
    settings: dict | None = None
    stream_url: str | None = None
    stream_key: str | None = None
    destination_id: str | None = None


def _call_provider(method_name: str, provider_id: str, body: BroadcastBody) -> dict:
    provider = get_provider(provider_id)
    method = getattr(provider, method_name)
    if method_name == "prepare_broadcast":
        return method(
            body.access_token,
            body.title,
            body.description,
            stream_url=body.stream_url,
            stream_key=body.stream_key,
            settings=body.settings,
            destination_id=body.destination_id,
            broadcast_id=body.broadcast_id,
        )
    return method(
        body.access_token,
        body.broadcast_id,
        stream_url=body.stream_url,
        stream_key=body.stream_key,
        settings=body.settings,
        destination_id=body.destination_id,
    )


class EncoderBody(BaseModel):
    destination_id: str
    stream_url: str | None = None
    stream_key: str | None = None
    video_device_label: str | None = None
    audio_device_label: str | None = None


@router.get("/providers/{provider_id}/configured")
def provider_is_configured(provider_id: str, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return {"configured": provider_configured(provider_id)}


@router.post("/providers/{provider_id}/oauth/start")
def oauth_start(
    provider_id: str,
    body: OAuthStartBody,
    x_internal_token: str | None = Header(default=None),
):
    _verify_token(x_internal_token)
    provider = get_provider(provider_id)
    try:
        url = provider.get_authorization_url(body.state, body.redirect_uri)
        return {"configured": True, "authorizationUrl": url}
    except ProviderNotConfiguredError as exc:
        return {
            "configured": False,
            "authorizationUrl": None,
            "developmentMessage": str(exc),
        }


@router.post("/providers/{provider_id}/oauth/callback")
def oauth_callback(
    provider_id: str,
    body: OAuthCallbackBody,
    x_internal_token: str | None = Header(default=None),
):
    _verify_token(x_internal_token)
    provider = get_provider(provider_id)
    try:
        tokens = provider.handle_callback(body.code, body.redirect_uri)
        account_name = "Connected Account"
        account_email = None
        channel_id = None
        channel_name = None
        profile_image_url = None
        permissions: list[str] = []
        access_token = tokens.get("access_token")
        if access_token and hasattr(provider, "get_account_info"):
            try:
                info = provider.get_account_info(access_token)
                account_name = info.account_name
                account_email = info.account_email
                channel_id = info.channel_id
                channel_name = info.channel_name
                profile_image_url = info.profile_image_url
                permissions = info.permissions or []
            except Exception:
                pass
        return {
            "tokens": tokens,
            "accountName": account_name,
            "accountEmail": account_email,
            "channelId": channel_id,
            "channelName": channel_name,
            "profileImageUrl": profile_image_url,
            "permissions": permissions,
        }
    except ProviderNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/providers/{provider_id}/oauth/refresh")
def oauth_refresh(
    provider_id: str,
    body: OAuthRefreshBody,
    x_internal_token: str | None = Header(default=None),
):
    _verify_token(x_internal_token)
    provider = get_provider(provider_id)
    if not hasattr(provider, "refresh_token"):
        raise HTTPException(status_code=400, detail="Provider does not support token refresh.")
    return provider.refresh_token(body.refresh_token)


@router.post("/providers/{provider_id}/test")
def test_connection(
    provider_id: str,
    body: TestConnectionBody,
    x_internal_token: str | None = Header(default=None),
):
    _verify_token(x_internal_token)
    provider = get_provider(provider_id)
    result = provider.test_connection(
        access_token=body.access_token,
        stream_url=body.stream_url,
        stream_key=body.stream_key,
        settings=body.settings,
        video_profile=body.video_profile,
        audio_profile=body.audio_profile,
        privacy=body.privacy,
        scheduled_start_at=body.scheduled_start_at,
    )
    return {
        "success": result.success,
        "message": result.message,
        "steps": result.steps,
    }


@router.post("/providers/{provider_id}/validate")
def validate_destination(
    provider_id: str,
    body: TestConnectionBody,
    x_internal_token: str | None = Header(default=None),
):
    _verify_token(x_internal_token)
    provider = get_provider(provider_id)
    result = provider.test_destination(
        access_token=body.access_token,
        refresh_token=body.refresh_token,
        token_expires_at=body.token_expires_at,
        stream_url=body.stream_url,
        stream_key=body.stream_key,
        settings=body.settings,
        video_profile=body.video_profile,
        audio_profile=body.audio_profile,
        privacy=body.privacy,
        scheduled_start_at=body.scheduled_start_at,
    )
    return result.to_dict(include_technical=body.developer_mode)


@router.post("/providers/{provider_id}/validate-rtmp")
def validate_rtmp(
    provider_id: str,
    body: TestConnectionBody,
    x_internal_token: str | None = Header(default=None),
):
    _verify_token(x_internal_token)
    provider = get_provider(provider_id)
    result = provider.validate_rtmp_readiness(
        access_token=body.access_token,
        stream_url=body.stream_url,
        stream_key=body.stream_key,
        settings=body.settings,
    )
    return result.to_dict(include_technical=body.developer_mode)


@router.post("/providers/{provider_id}/ingest-info")
def ingest_info(
    provider_id: str,
    body: BroadcastBody,
    x_internal_token: str | None = Header(default=None),
):
    _verify_token(x_internal_token)
    provider = get_provider(provider_id)
    return provider.get_ingest_info(
        access_token=body.access_token,
        stream_url=body.stream_url,
        stream_key=body.stream_key,
        settings=body.settings,
        broadcast_id=body.broadcast_id,
    )


@router.post("/providers/{provider_id}/prepare")
def prepare_broadcast(
    provider_id: str,
    body: BroadcastBody,
    x_internal_token: str | None = Header(default=None),
):
    _verify_token(x_internal_token)
    return _call_provider("prepare_broadcast", provider_id, body)


@router.post("/providers/{provider_id}/start")
def start_broadcast(
    provider_id: str,
    body: BroadcastBody,
    x_internal_token: str | None = Header(default=None),
):
    _verify_token(x_internal_token)
    return _call_provider("start_broadcast", provider_id, body)


@router.post("/providers/{provider_id}/stop")
def stop_broadcast(
    provider_id: str,
    body: BroadcastBody,
    x_internal_token: str | None = Header(default=None),
):
    _verify_token(x_internal_token)
    return _call_provider("stop_broadcast", provider_id, body)


@router.get("/encoder/health")
def encoder_health(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    encoder_service.heartbeat()
    return encoder_service.health()


@router.post("/encoder/heartbeat")
def encoder_heartbeat(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    encoder_service.heartbeat()
    return {"ok": True}


@router.post("/encoder/prepare")
def encoder_prepare(body: EncoderBody, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return encoder_service.prepare(
        body.destination_id,
        body.stream_url,
        body.stream_key,
        body.video_device_label,
        body.audio_device_label,
    )


@router.post("/encoder/start")
def encoder_start(body: EncoderBody, x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return encoder_service.start(
        body.destination_id,
        body.stream_url,
        body.stream_key,
        body.video_device_label,
        body.audio_device_label,
    )


@router.post("/encoder/stop")
def encoder_stop(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return encoder_service.stop()


@router.get("/encoder/devices")
def encoder_devices(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return encoder_service.list_devices()


@router.get("/encoder/detect")
def encoder_detect(x_internal_token: str | None = Header(default=None)):
    _verify_token(x_internal_token)
    return detect_encoders()


@router.get("/encoder/preview-stats")
def encoder_preview_stats(
    destination_id: str,
    x_internal_token: str | None = Header(default=None),
):
    _verify_token(x_internal_token)
    return encoder_service.preview_stats(destination_id)
