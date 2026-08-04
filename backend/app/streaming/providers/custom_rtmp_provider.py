from __future__ import annotations

from urllib.parse import urlparse

import httpx

from app.streaming.encoder_service import encoder_service
from app.streaming.providers.base_provider import BaseStreamingProvider, ProviderValidationResult
from app.streaming.providers.validation_helpers import check, merge_validation_results


class CustomRtmpProvider(BaseStreamingProvider):
    provider_id = "custom_rtmp"

    def is_configured(self) -> bool:
        return True

    def validate_rtmp_readiness(
        self,
        *,
        access_token: str | None = None,
        stream_url: str | None = None,
        stream_key: str | None = None,
        settings: dict | None = None,
    ) -> ProviderValidationResult:
        settings = settings or {}
        url = stream_url or str(settings.get("streamUrl") or "")
        key = stream_key or str(settings.get("streamKey") or "")
        parsed = urlparse(url)
        scheme_ok = parsed.scheme.lower() in {"rtmp", "rtmps"}
        url_ok = bool(url) and bool(parsed.netloc) and scheme_ok
        key_ok = bool(key)
        backup = str(settings.get("backupStreamUrl") or "")
        backup_ok = True
        if backup:
            backup_parsed = urlparse(backup)
            backup_ok = backup_parsed.scheme.lower() in {"rtmp", "rtmps"} and bool(backup_parsed.netloc)
        reachable = False
        if url_ok:
            try:
                response = httpx.head(url, timeout=8.0, follow_redirects=True)
                reachable = response.status_code < 500
            except httpx.HTTPError:
                reachable = False
        ok = url_ok and key_ok and backup_ok
        return ProviderValidationResult(
            ok=ok,
            status="ready" if ok else "needs_attention",
            checks=[
                check("stream_url", "Stream URL format", url_ok, "Stream URL uses RTMP or RTMPS." if url_ok else "Enter a valid RTMP or RTMPS stream URL.", severity="critical" if not url_ok else "info"),
                check("stream_key", "Stream key saved securely", key_ok, "Stream key saved securely." if key_ok else "Add your stream key in settings.", severity="critical" if not key_ok else "info"),
                check("backup_url", "Backup URL format", backup_ok, "Backup stream URL is valid." if backup_ok else "Backup stream URL must use RTMP or RTMPS.", severity="warning" if not backup_ok else "info"),
                check("server_reachable", "Server reachable", reachable, "Custom server responded." if reachable else "Custom server did not respond. Check the stream URL and try again.", severity="warning" if not reachable else "info"),
                check("rtmp_ready", "RTMP ready", ok, "RTMP ingest credentials are ready." if ok else "RTMP ingest is not ready.", severity="critical" if not ok else "info"),
            ],
            safe_user_message="Custom streaming server is ready." if ok else "Custom server did not respond. Check the stream URL and try again.",
        )

    def test_destination(self, **kwargs) -> ProviderValidationResult:
        return merge_validation_results(
            [
                ProviderValidationResult(
                    ok=True,
                    status="ready",
                    checks=[check("oauth_token_present", "Account connected", True, "Custom RTMP server configured.")],
                    safe_user_message="Account connected.",
                ),
                self.validate_rtmp_readiness(
                    stream_url=kwargs.get("stream_url"),
                    stream_key=kwargs.get("stream_key"),
                    settings=kwargs.get("settings"),
                ),
                self.validate_destination_limits(
                    video_profile=kwargs.get("video_profile"),
                    audio_profile=kwargs.get("audio_profile"),
                ),
            ],
            default_message="Custom streaming server is ready.",
        )

    def prepare_broadcast(
        self,
        access_token: str,
        title: str,
        description: str,
        *,
        stream_url: str | None = None,
        stream_key: str | None = None,
        settings: dict | None = None,
        destination_id: str | None = None,
        broadcast_id: str | None = None,
        **kwargs,
    ) -> dict:
        if not destination_id:
            raise ValueError("Destination id is required for custom RTMP prepare.")
        return encoder_service.prepare(destination_id, stream_url, stream_key)

    def start_broadcast(
        self,
        access_token: str,
        broadcast_id: str | None = None,
        *,
        stream_url: str | None = None,
        stream_key: str | None = None,
        settings: dict | None = None,
        destination_id: str | None = None,
        **kwargs,
    ) -> dict:
        if not destination_id:
            raise ValueError("Destination id is required for custom RTMP start.")
        result = encoder_service.start(destination_id, stream_url, stream_key)
        if not result.get("success"):
            raise ValueError(str(result.get("message") or "Could not start custom RTMP stream."))
        return {"started": True, "broadcastId": destination_id}

    def stop_broadcast(
        self,
        access_token: str,
        broadcast_id: str | None = None,
        *,
        stream_url: str | None = None,
        stream_key: str | None = None,
        settings: dict | None = None,
        destination_id: str | None = None,
        **kwargs,
    ) -> dict:
        result = encoder_service.stop()
        if not result.get("success"):
            raise ValueError(str(result.get("message") or "Could not stop custom RTMP stream."))
        return {"stopped": True, "broadcastId": broadcast_id or destination_id}


class ChurchWebsiteProvider(BaseStreamingProvider):
    provider_id = "church_website"

    def is_configured(self) -> bool:
        return True

    def validate_live_capability(self, *, access_token: str | None = None, settings: dict | None = None) -> ProviderValidationResult:
        settings = settings or {}
        page_url = str(settings.get("streamPageUrl") or "")
        if not page_url:
            return ProviderValidationResult(
                ok=False,
                status="needs_attention",
                checks=[check("live_capability", "Website page reachable", False, "Add your church website stream page URL first.", severity="critical")],
                safe_user_message="Add your church website stream page URL first.",
            )
        try:
            response = httpx.head(page_url, timeout=8.0, follow_redirects=True)
            ok = response.status_code < 400
            return ProviderValidationResult(
                ok=ok,
                status="ready" if ok else "needs_attention",
                checks=[check("live_capability", "Website page reachable", ok, "Church website stream page is reachable." if ok else "We could not reach your church website stream page.", severity="critical" if not ok else "info")],
                safe_user_message="Church website stream page looks good." if ok else "We could not reach your church website stream page.",
            )
        except httpx.HTTPError as exc:
            return ProviderValidationResult(
                ok=False,
                status="error",
                checks=[check("live_capability", "Website page reachable", False, "Could not reach church website.", severity="critical")],
                safe_user_message="We could not reach your church website stream page.",
                technical_error=str(exc),
            )

    def prepare_broadcast(
        self,
        access_token: str,
        title: str,
        description: str,
        *,
        stream_url: str | None = None,
        stream_key: str | None = None,
        settings: dict | None = None,
        destination_id: str | None = None,
        broadcast_id: str | None = None,
        **kwargs,
    ) -> dict:
        settings = settings or {}
        page_url = str(settings.get("streamPageUrl") or stream_url or "")
        if not page_url:
            raise ValueError("Church website stream page URL is missing.")
        response = httpx.head(page_url, timeout=8.0, follow_redirects=True)
        if response.status_code >= 400:
            raise ValueError("We could not reach your church website stream page.")
        if stream_url and stream_key and destination_id:
            encoder_result = encoder_service.prepare(destination_id, stream_url, stream_key)
            if not encoder_result.get("success"):
                raise ValueError(str(encoder_result.get("message")))
        return {"prepared": True, "broadcastId": destination_id or page_url, "streamPageUrl": page_url}

    def start_broadcast(
        self,
        access_token: str,
        broadcast_id: str | None = None,
        *,
        stream_url: str | None = None,
        stream_key: str | None = None,
        settings: dict | None = None,
        destination_id: str | None = None,
        **kwargs,
    ) -> dict:
        if stream_url and stream_key and destination_id:
            result = encoder_service.start(destination_id, stream_url, stream_key)
            if not result.get("success"):
                raise ValueError(str(result.get("message") or "Could not start encoder for church website stream."))
        settings = settings or {}
        page_url = str(settings.get("streamPageUrl") or stream_url or "")
        if page_url:
            response = httpx.head(page_url, timeout=8.0, follow_redirects=True)
            if response.status_code >= 400:
                raise ValueError("Church website stream page is not reachable.")
        return {"started": True, "broadcastId": broadcast_id or destination_id}

    def stop_broadcast(
        self,
        access_token: str,
        broadcast_id: str | None = None,
        *,
        stream_url: str | None = None,
        stream_key: str | None = None,
        settings: dict | None = None,
        destination_id: str | None = None,
        **kwargs,
    ) -> dict:
        if stream_url and stream_key:
            result = encoder_service.stop()
            if not result.get("success"):
                raise ValueError(str(result.get("message") or "Could not stop encoder."))
        return {"stopped": True, "broadcastId": broadcast_id or destination_id}
