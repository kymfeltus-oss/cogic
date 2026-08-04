from __future__ import annotations

import os
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx

from app.streaming.providers.base_provider import (
    BaseStreamingProvider,
    ProviderAccountInfo,
    ProviderNotConfiguredError,
    ProviderValidationResult,
)
from app.streaming.providers.validation_helpers import check, merge_validation_results


class YouTubeProvider(BaseStreamingProvider):
    provider_id = "youtube"

    def _client(self) -> tuple[str, str]:
        client_id = os.getenv("YOUTUBE_CLIENT_ID", "").strip()
        client_secret = os.getenv("YOUTUBE_CLIENT_SECRET", "").strip()
        return client_id, client_secret

    def is_configured(self) -> bool:
        client_id, client_secret = self._client()
        return bool(client_id and client_secret)

    def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        client_id, _ = self._client()
        if not client_id:
            raise ProviderNotConfiguredError(
                "YouTube connection is not configured in this development environment."
            )
        params = urlencode(
            {
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl",
                "access_type": "offline",
                "prompt": "consent",
                "state": state,
            }
        )
        return f"https://accounts.google.com/o/oauth2/v2/auth?{params}"

    def handle_callback(self, code: str, redirect_uri: str) -> dict:
        client_id, client_secret = self._client()
        response = httpx.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=15.0,
        )
        response.raise_for_status()
        return response.json()

    def refresh_token(self, refresh_token: str) -> dict:
        client_id, client_secret = self._client()
        response = httpx.post(
            "https://oauth2.googleapis.com/token",
            data={
                "refresh_token": refresh_token,
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "refresh_token",
            },
            timeout=15.0,
        )
        response.raise_for_status()
        return response.json()

    def _auth_headers(self, access_token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {access_token}"}

    def _token_expired(self, token_expires_at: str | None) -> bool:
        if not token_expires_at:
            return False
        try:
            expires = datetime.fromisoformat(token_expires_at.replace("Z", "+00:00"))
            return expires <= datetime.now(timezone.utc)
        except ValueError:
            return False

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
                    check("oauth_token_present", "Account connected", False, "YouTube is not connected yet.", severity="critical"),
                ],
                safe_user_message="Connect your YouTube account before continuing.",
            )

        expired = self._token_expired(token_expires_at)
        if expired:
            if refresh_token:
                try:
                    tokens = self.refresh_token(refresh_token)
                    return ProviderValidationResult(
                        ok=True,
                        status="ready",
                        checks=[
                            check("oauth_token_present", "Account connected", True, "YouTube account is connected."),
                            check("oauth_token_fresh", "OAuth token valid", True, "Access token was refreshed."),
                        ],
                        safe_user_message="YouTube account connected.",
                        refreshed_tokens=tokens,
                    )
                except httpx.HTTPError as exc:
                    return ProviderValidationResult(
                        ok=False,
                        status="error",
                        checks=[
                            check("oauth_token_present", "Account connected", True, "YouTube account is connected."),
                            check("oauth_token_fresh", "OAuth token valid", False, "YouTube token expired and could not be refreshed.", severity="critical"),
                        ],
                        safe_user_message="YouTube permission expired. Reconnect YouTube.",
                        technical_error=str(exc),
                    )
            return ProviderValidationResult(
                ok=False,
                status="error",
                checks=[
                    check("oauth_token_present", "Account connected", True, "YouTube account is connected."),
                    check("oauth_token_fresh", "OAuth token valid", False, "YouTube access token has expired.", severity="critical"),
                ],
                safe_user_message="YouTube permission expired. Reconnect YouTube.",
            )

        return ProviderValidationResult(
            ok=True,
            status="ready",
            checks=[
                check("oauth_token_present", "Account connected", True, "YouTube account is connected."),
                check("oauth_token_fresh", "OAuth token valid", True, "Access token is valid."),
            ],
            safe_user_message="YouTube account connected.",
        )

    def validate_permissions(self, *, access_token: str | None = None, settings: dict | None = None) -> ProviderValidationResult:
        if not access_token:
            return ProviderValidationResult(ok=False, status="error", checks=[], safe_user_message="YouTube is not connected.")
        try:
            response = httpx.get(
                "https://www.googleapis.com/youtube/v3/channels",
                params={"part": "snippet", "mine": "true"},
                headers=self._auth_headers(access_token),
                timeout=12.0,
            )
            if response.status_code == 401:
                return ProviderValidationResult(
                    ok=False,
                    status="error",
                    checks=[check("permissions", "Permissions verified", False, "YouTube rejected the access token.", severity="critical")],
                    safe_user_message="YouTube permission expired. Reconnect YouTube.",
                    technical_error=response.text,
                )
            if response.status_code == 403:
                reason = response.json().get("error", {}).get("errors", [{}])[0].get("reason", "")
                if reason == "insufficientPermissions":
                    return ProviderValidationResult(
                        ok=False,
                        status="error",
                        checks=[check("permissions", "Permissions verified", False, "YouTube live permissions are missing.", severity="critical")],
                        safe_user_message="YouTube needs permission to manage live broadcasts. Reconnect YouTube.",
                        technical_error=response.text,
                    )
            ok = response.status_code == 200 and bool((response.json().get("items") or []))
            return ProviderValidationResult(
                ok=ok,
                status="ready" if ok else "error",
                checks=[
                    check("permissions", "Permissions verified", ok, "YouTube channel access confirmed." if ok else "Could not verify YouTube channel permissions.", severity="critical" if not ok else "info"),
                    check("channel_exists", "Channel exists", ok, "YouTube channel found." if ok else "No YouTube channel found for this account.", severity="critical" if not ok else "info"),
                ],
                safe_user_message="Permissions verified." if ok else "YouTube channel not found for this account.",
                technical_error=None if ok else response.text,
            )
        except httpx.HTTPError as exc:
            return ProviderValidationResult(
                ok=False,
                status="error",
                checks=[check("permissions", "Permissions verified", False, "Could not reach YouTube.", severity="critical")],
                safe_user_message="Could not reach YouTube. Check your internet connection and try again.",
                technical_error=str(exc),
            )

    def validate_quota(self, *, access_token: str | None = None, settings: dict | None = None) -> ProviderValidationResult:
        if not access_token:
            return ProviderValidationResult(ok=False, status="error", checks=[], safe_user_message="YouTube is not connected.")
        try:
            response = httpx.get(
                "https://www.googleapis.com/youtube/v3/liveBroadcasts",
                params={"part": "id", "broadcastStatus": "all", "mine": "true", "maxResults": 1},
                headers=self._auth_headers(access_token),
                timeout=12.0,
            )
            if response.status_code == 403:
                errors = response.json().get("error", {}).get("errors", [])
                reason = errors[0].get("reason") if errors else ""
                if reason == "quotaExceeded":
                    return ProviderValidationResult(
                        ok=False,
                        status="error",
                        checks=[check("quota", "Quota available", False, "YouTube API quota exceeded.", severity="critical")],
                        safe_user_message="YouTube API quota exceeded. Try again later.",
                        technical_error=response.text,
                    )
            ok = response.status_code == 200
            return ProviderValidationResult(
                ok=ok,
                status="ready" if ok else "needs_attention",
                checks=[check("quota", "Quota available", ok, "YouTube API quota looks available." if ok else "Could not verify YouTube quota.", severity="warning" if not ok else "info")],
                safe_user_message="Quota available." if ok else "Could not verify YouTube quota.",
                technical_error=None if ok else response.text,
            )
        except httpx.HTTPError as exc:
            return ProviderValidationResult(
                ok=False,
                status="error",
                checks=[check("quota", "Quota available", False, "Could not reach YouTube.", severity="critical")],
                safe_user_message="Could not reach YouTube.",
                technical_error=str(exc),
            )

    def validate_live_capability(self, *, access_token: str | None = None, settings: dict | None = None) -> ProviderValidationResult:
        if not access_token:
            return ProviderValidationResult(ok=False, status="error", checks=[], safe_user_message="YouTube is not connected.")
        try:
            response = httpx.get(
                "https://www.googleapis.com/youtube/v3/liveBroadcasts",
                params={"part": "status", "broadcastStatus": "all", "mine": "true", "maxResults": 1},
                headers=self._auth_headers(access_token),
                timeout=12.0,
            )
            if response.status_code == 403:
                return ProviderValidationResult(
                    ok=False,
                    status="error",
                    checks=[check("live_capability", "Livestreaming enabled", False, "YouTube live streaming is not enabled on this channel.", severity="critical")],
                    safe_user_message="YouTube live streaming is not enabled on this channel. Open YouTube Studio and enable live streaming.",
                    technical_error=response.text,
                )
            ok = response.status_code == 200
            return ProviderValidationResult(
                ok=ok,
                status="ready" if ok else "needs_attention",
                checks=[check("live_capability", "Livestreaming enabled", ok, "YouTube live streaming is enabled." if ok else "Could not verify YouTube live streaming.", severity="critical" if not ok else "info")],
                safe_user_message="Livestreaming enabled." if ok else "Could not verify YouTube live streaming.",
            )
        except httpx.HTTPError as exc:
            return ProviderValidationResult(
                ok=False,
                status="error",
                checks=[check("live_capability", "Livestreaming enabled", False, "Could not reach YouTube.", severity="critical")],
                safe_user_message="Could not reach YouTube.",
                technical_error=str(exc),
            )

    def validate_destination_limits(
        self,
        *,
        access_token: str | None = None,
        settings: dict | None = None,
        video_profile: dict | None = None,
        audio_profile: dict | None = None,
    ) -> ProviderValidationResult:
        video_profile = video_profile or {}
        audio_profile = audio_profile or {}
        resolution = str(video_profile.get("resolution") or "1080p")
        fps = int(video_profile.get("fps") or 30)
        video_ok = resolution in {"720p", "1080p", "1440p", "2160p", "4K"} and fps in {24, 30, 60}
        audio_ok = str(audio_profile.get("channels") or "stereo") in {"mono", "stereo"}
        ok = video_ok and audio_ok
        return ProviderValidationResult(
            ok=ok,
            status="ready" if ok else "needs_attention",
            checks=[
                check("video_settings", "Video settings compatible", video_ok, f"YouTube supports {resolution} at {fps} fps." if video_ok else "Selected video settings are not supported on YouTube.", severity="warning" if not video_ok else "info"),
                check("audio_settings", "Audio settings compatible", audio_ok, "Selected audio settings are supported on YouTube." if audio_ok else "Selected audio settings are not supported on YouTube.", severity="warning" if not audio_ok else "info"),
            ],
            safe_user_message="Stream settings are compatible." if ok else "Adjust your video or audio settings for YouTube.",
        )

    def validate_rtmp_readiness(
        self,
        *,
        access_token: str | None = None,
        stream_url: str | None = None,
        stream_key: str | None = None,
        settings: dict | None = None,
    ) -> ProviderValidationResult:
        if not access_token:
            return ProviderValidationResult(ok=False, status="error", checks=[], safe_user_message="YouTube is not connected.")
        try:
            response = httpx.get(
                "https://www.googleapis.com/youtube/v3/liveStreams",
                params={"part": "cdn,status", "mine": "true", "maxResults": 1},
                headers=self._auth_headers(access_token),
                timeout=12.0,
            )
            if response.status_code == 403:
                return ProviderValidationResult(
                    ok=False,
                    status="error",
                    checks=[check("rtmp_ready", "RTMP ready", False, "YouTube denied live stream access.", severity="critical")],
                    safe_user_message="YouTube needs permission to create live streams. Reconnect YouTube.",
                    technical_error=response.text,
                )
            ok = response.status_code == 200
            return ProviderValidationResult(
                ok=ok,
                status="ready" if ok else "needs_attention",
                checks=[check("rtmp_ready", "RTMP ready", ok, "YouTube RTMP ingest can be prepared." if ok else "Could not verify YouTube RTMP ingest.", severity="critical" if not ok else "info")],
                safe_user_message="RTMP ready." if ok else "Could not verify YouTube RTMP ingest.",
            )
        except httpx.HTTPError as exc:
            return ProviderValidationResult(
                ok=False,
                status="error",
                checks=[check("rtmp_ready", "RTMP ready", False, "Could not reach YouTube.", severity="critical")],
                safe_user_message="Could not reach YouTube.",
                technical_error=str(exc),
            )

    def test_destination(self, **kwargs) -> ProviderValidationResult:
        if not self.is_configured():
            return ProviderValidationResult(
                ok=False,
                status="error",
                checks=[check("provider_configured", "Platform configured", False, "YouTube connection is not configured in this development environment.", severity="critical")],
                safe_user_message="YouTube connection is not configured in this development environment.",
            )
        oauth = self.validate_oauth_token(
            access_token=kwargs.get("access_token"),
            refresh_token=kwargs.get("refresh_token"),
            token_expires_at=kwargs.get("token_expires_at"),
        )
        if not oauth.ok:
            return oauth
        access_token = oauth.refreshed_tokens.get("access_token") if oauth.refreshed_tokens else kwargs.get("access_token")
        return merge_validation_results(
            [
                oauth,
                self.validate_permissions(access_token=access_token, settings=kwargs.get("settings")),
                self.validate_quota(access_token=access_token, settings=kwargs.get("settings")),
                self.validate_live_capability(access_token=access_token, settings=kwargs.get("settings")),
                self.validate_destination_limits(
                    access_token=access_token,
                    settings=kwargs.get("settings"),
                    video_profile=kwargs.get("video_profile"),
                    audio_profile=kwargs.get("audio_profile"),
                ),
                self.validate_rtmp_readiness(access_token=access_token, settings=kwargs.get("settings")),
            ],
            default_message="YouTube is ready to stream.",
        )

    def get_account_info(self, access_token: str) -> ProviderAccountInfo:
        response = httpx.get(
            "https://www.googleapis.com/youtube/v3/channels",
            params={"part": "snippet", "mine": "true"},
            headers=self._auth_headers(access_token),
            timeout=12.0,
        )
        response.raise_for_status()
        payload = response.json()
        items = payload.get("items") or []
        if not items:
            return ProviderAccountInfo(account_name="YouTube Channel")
        item = items[0]
        snippet = item.get("snippet") or {}
        thumbs = snippet.get("thumbnails") or {}
        thumb = thumbs.get("default") or thumbs.get("medium") or {}
        return ProviderAccountInfo(
            account_name=str(snippet.get("title") or "YouTube Channel"),
            channel_id=str(item.get("id") or ""),
            channel_name=str(snippet.get("title") or "YouTube Channel"),
            profile_image_url=str(thumb.get("url") or "") or None,
            permissions=["youtube.readonly", "youtube.force-ssl"],
        )

    def _find_broadcast_id(self, access_token: str) -> str | None:
        response = httpx.get(
            "https://www.googleapis.com/youtube/v3/liveBroadcasts",
            params={"part": "id,status", "broadcastStatus": "active", "mine": "true", "maxResults": 1},
            headers=self._auth_headers(access_token),
            timeout=15.0,
        )
        if response.status_code != 200:
            return None
        items = response.json().get("items") or []
        if not items:
            return None
        return str(items[0].get("id") or "")

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
        privacy: str | None = None,
        scheduled_start_at: str | None = None,
        dry_run: bool = False,
    ) -> dict:
        if dry_run:
            validation = self.test_destination(access_token=access_token, settings=settings)
            return {"prepared": validation.ok, "dryRun": True, "message": validation.safe_user_message}
        headers = self._auth_headers(access_token)
        privacy_status = privacy or "public"
        snippet: dict = {"title": title or "Live Service", "description": description or ""}
        if scheduled_start_at:
            snippet["scheduledStartTime"] = scheduled_start_at
        broadcast_resp = httpx.post(
            "https://www.googleapis.com/youtube/v3/liveBroadcasts",
            params={"part": "snippet,status,contentDetails"},
            json={
                "snippet": snippet,
                "status": {"privacyStatus": privacy_status, "selfDeclaredMadeForKids": False},
                "contentDetails": {"enableAutoStart": False, "enableAutoStop": True},
            },
            headers=headers,
            timeout=20.0,
        )
        broadcast_resp.raise_for_status()
        broadcast_id = broadcast_resp.json()["id"]

        stream_resp = httpx.post(
            "https://www.googleapis.com/youtube/v3/liveStreams",
            params={"part": "snippet,cdn,status"},
            json={
                "snippet": {"title": f"{title or 'Live Service'} Stream"},
                "cdn": {"frameRate": "30fps", "ingestionType": "rtmp", "resolution": "1080p"},
            },
            headers=headers,
            timeout=20.0,
        )
        stream_resp.raise_for_status()
        stream_data = stream_resp.json()
        stream_id = stream_data["id"]
        ingestion = (stream_data.get("cdn") or {}).get("ingestionInfo") or {}

        bind_resp = httpx.post(
            "https://www.googleapis.com/youtube/v3/liveBroadcasts/bind",
            params={"part": "id,contentDetails", "id": broadcast_id, "streamId": stream_id},
            headers=headers,
            timeout=20.0,
        )
        bind_resp.raise_for_status()

        return {
            "prepared": True,
            "broadcastId": broadcast_id,
            "streamId": stream_id,
            "ingestionAddress": ingestion.get("ingestionAddress"),
            "streamName": ingestion.get("streamName"),
        }

    def start_broadcast(self, access_token: str, broadcast_id: str | None = None, **kwargs) -> dict:
        bid = broadcast_id or self._find_broadcast_id(access_token)
        if not bid:
            raise ValueError("No prepared YouTube broadcast found.")
        response = httpx.post(
            "https://www.googleapis.com/youtube/v3/liveBroadcasts/transition",
            params={"part": "status", "id": bid, "broadcastStatus": "live"},
            headers=self._auth_headers(access_token),
            timeout=20.0,
        )
        response.raise_for_status()
        return {"started": True, "broadcastId": bid}

    def stop_broadcast(self, access_token: str, broadcast_id: str | None = None, **kwargs) -> dict:
        bid = broadcast_id or self._find_broadcast_id(access_token)
        if not bid:
            return {"stopped": True, "message": "No active YouTube broadcast."}
        response = httpx.post(
            "https://www.googleapis.com/youtube/v3/liveBroadcasts/transition",
            params={"part": "status", "id": bid, "broadcastStatus": "complete"},
            headers=self._auth_headers(access_token),
            timeout=20.0,
        )
        if response.status_code >= 400:
            response.raise_for_status()
        return {"stopped": True, "broadcastId": bid}
