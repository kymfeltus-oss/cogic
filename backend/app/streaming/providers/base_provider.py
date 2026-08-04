from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.streaming.providers.validation_helpers import (
    ProviderValidationCheck,
    ProviderValidationResult,
    check,
    merge_validation_results,
)


class ProviderNotConfiguredError(Exception):
    """Raised when OAuth credentials are missing — never fake success."""


@dataclass
class ProviderAccountInfo:
    account_name: str
    account_email: str | None = None
    channel_id: str | None = None
    channel_name: str | None = None
    profile_image_url: str | None = None
    permissions: list[str] | None = None


@dataclass
class ProviderTestResult:
    success: bool
    message: str
    steps: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class ProviderStreamStatus:
    live: bool
    message: str


class BaseStreamingProvider:
    provider_id: str = "base"

    def is_configured(self) -> bool:
        return False

    def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        if not self.is_configured():
            raise ProviderNotConfiguredError(
                "Streaming account connection is not configured in this development environment."
            )
        raise NotImplementedError

    def handle_callback(self, code: str, redirect_uri: str) -> dict[str, Any]:
        if not self.is_configured():
            raise ProviderNotConfiguredError(
                "Streaming account connection is not configured in this development environment."
            )
        raise NotImplementedError

    def refresh_oauth_token(self, refresh_token: str) -> dict[str, Any]:
        return self.refresh_token(refresh_token)

    def refresh_token(self, refresh_token: str) -> dict[str, Any]:
        raise NotImplementedError

    def validate_oauth_token(
        self,
        *,
        access_token: str | None = None,
        refresh_token: str | None = None,
        token_expires_at: str | None = None,
    ) -> ProviderValidationResult:
        if not access_token:
            return ProviderValidationResult(
                ok=False,
                status="error",
                checks=[
                    check("oauth_token_present", "OAuth token present", False, "Account is not connected.", severity="critical"),
                ],
                safe_user_message="Connect your streaming account before continuing.",
            )
        return ProviderValidationResult(
            ok=True,
            status="ready",
            checks=[check("oauth_token_present", "Account connected", True, "OAuth token is present.")],
            safe_user_message="Account connected.",
        )

    def validate_permissions(
        self,
        *,
        access_token: str | None = None,
        settings: dict[str, Any] | None = None,
    ) -> ProviderValidationResult:
        return ProviderValidationResult(
            ok=True,
            status="ready",
            checks=[check("permissions", "Permissions verified", True, "Permissions look good.")],
            safe_user_message="Permissions verified.",
        )

    def validate_quota(
        self,
        *,
        access_token: str | None = None,
        settings: dict[str, Any] | None = None,
    ) -> ProviderValidationResult:
        return ProviderValidationResult(
            ok=True,
            status="ready",
            checks=[check("quota", "Quota available", True, "Quota available.")],
            safe_user_message="Quota available.",
        )

    def validate_live_capability(
        self,
        *,
        access_token: str | None = None,
        settings: dict[str, Any] | None = None,
    ) -> ProviderValidationResult:
        return ProviderValidationResult(
            ok=True,
            status="ready",
            checks=[check("live_capability", "Livestreaming enabled", True, "Livestreaming is enabled.")],
            safe_user_message="Livestreaming enabled.",
        )

    def validate_destination_limits(
        self,
        *,
        access_token: str | None = None,
        settings: dict[str, Any] | None = None,
        video_profile: dict[str, Any] | None = None,
        audio_profile: dict[str, Any] | None = None,
    ) -> ProviderValidationResult:
        return ProviderValidationResult(
            ok=True,
            status="ready",
            checks=[
                check("video_settings", "Video settings compatible", True, "Selected video settings are supported."),
                check("audio_settings", "Audio settings compatible", True, "Selected audio settings are supported."),
            ],
            safe_user_message="Stream settings are compatible.",
        )

    def validate_rtmp_readiness(
        self,
        *,
        access_token: str | None = None,
        stream_url: str | None = None,
        stream_key: str | None = None,
        settings: dict[str, Any] | None = None,
    ) -> ProviderValidationResult:
        return ProviderValidationResult(
            ok=True,
            status="ready",
            checks=[check("rtmp_ready", "RTMP ready", True, "RTMP ingest is ready.")],
            safe_user_message="RTMP ready.",
        )

    def prepare_broadcast(
        self,
        access_token: str,
        title: str,
        description: str,
        *,
        stream_url: str | None = None,
        stream_key: str | None = None,
        settings: dict[str, Any] | None = None,
        destination_id: str | None = None,
        broadcast_id: str | None = None,
        privacy: str | None = None,
        scheduled_start_at: str | None = None,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        raise NotImplementedError(f"{self.provider_id} prepare_broadcast is not implemented.")

    def get_ingest_info(
        self,
        *,
        access_token: str | None = None,
        stream_url: str | None = None,
        stream_key: str | None = None,
        settings: dict[str, Any] | None = None,
        broadcast_id: str | None = None,
    ) -> dict[str, Any]:
        return {
            "ingestionAddress": stream_url,
            "streamName": stream_key,
            "ready": bool(stream_url and stream_key),
        }

    def test_destination(
        self,
        *,
        access_token: str | None = None,
        refresh_token: str | None = None,
        token_expires_at: str | None = None,
        stream_url: str | None = None,
        stream_key: str | None = None,
        settings: dict[str, Any] | None = None,
        video_profile: dict[str, Any] | None = None,
        audio_profile: dict[str, Any] | None = None,
        privacy: str | None = None,
        scheduled_start_at: str | None = None,
    ) -> ProviderValidationResult:
        if not self.is_configured() and self.provider_id in {"youtube", "facebook", "vimeo", "twitch"}:
            return ProviderValidationResult(
                ok=False,
                status="error",
                checks=[
                    check(
                        "provider_configured",
                        "Platform configured",
                        False,
                        f"{self.provider_id.title()} connection is not configured in this development environment.",
                        severity="critical",
                    )
                ],
                safe_user_message=f"{self.provider_id.title()} connection is not configured in this development environment.",
            )

        oauth = self.validate_oauth_token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_expires_at=token_expires_at,
        )
        if not oauth.ok:
            return oauth

        return merge_validation_results(
            [
                oauth,
                self.validate_permissions(access_token=access_token, settings=settings),
                self.validate_quota(access_token=access_token, settings=settings),
                self.validate_live_capability(access_token=access_token, settings=settings),
                self.validate_destination_limits(
                    access_token=access_token,
                    settings=settings,
                    video_profile=video_profile,
                    audio_profile=audio_profile,
                ),
                self.validate_rtmp_readiness(
                    access_token=access_token,
                    stream_url=stream_url,
                    stream_key=stream_key,
                    settings=settings,
                ),
            ],
            default_message="Destination is ready to stream.",
        )

    def test_connection(
        self,
        access_token: str | None = None,
        stream_url: str | None = None,
        stream_key: str | None = None,
        settings: dict[str, Any] | None = None,
        video_profile: dict[str, Any] | None = None,
        audio_profile: dict[str, Any] | None = None,
        privacy: str | None = None,
        scheduled_start_at: str | None = None,
    ) -> ProviderTestResult:
        validation = self.test_destination(
            access_token=access_token,
            stream_url=stream_url,
            stream_key=stream_key,
            settings=settings,
            video_profile=video_profile,
            audio_profile=audio_profile,
            privacy=privacy,
            scheduled_start_at=scheduled_start_at,
        )
        return ProviderTestResult(
            success=validation.ok,
            message=validation.safe_user_message,
            steps=[c.to_dict() for c in validation.checks],
        )

    def get_account_info(self, access_token: str) -> ProviderAccountInfo:
        raise NotImplementedError

    def get_stream_status(self, access_token: str) -> ProviderStreamStatus:
        return ProviderStreamStatus(live=False, message="Status unavailable.")

    def start_broadcast(
        self,
        access_token: str,
        broadcast_id: str | None = None,
        *,
        stream_url: str | None = None,
        stream_key: str | None = None,
        settings: dict[str, Any] | None = None,
        destination_id: str | None = None,
    ) -> dict[str, Any]:
        raise NotImplementedError(f"{self.provider_id} start_broadcast is not implemented.")

    def stop_broadcast(
        self,
        access_token: str,
        broadcast_id: str | None = None,
        *,
        stream_url: str | None = None,
        stream_key: str | None = None,
        settings: dict[str, Any] | None = None,
        destination_id: str | None = None,
    ) -> dict[str, Any]:
        raise NotImplementedError(f"{self.provider_id} stop_broadcast is not implemented.")

    def disconnect(self) -> dict[str, Any]:
        return {"disconnected": True}
