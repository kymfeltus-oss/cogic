from __future__ import annotations

import os
from urllib.parse import urlencode

import httpx

from app.streaming.providers.base_provider import (
    BaseStreamingProvider,
    ProviderAccountInfo,
    ProviderNotConfiguredError,
    ProviderValidationResult,
)
from app.streaming.providers.validation_helpers import check


class TwitchProvider(BaseStreamingProvider):
    provider_id = "twitch"

    def _client(self) -> tuple[str, str]:
        return os.getenv("TWITCH_CLIENT_ID", "").strip(), os.getenv("TWITCH_CLIENT_SECRET", "").strip()

    def _api_headers(self, access_token: str) -> dict[str, str]:
        client_id, _ = self._client()
        return {"Authorization": f"Bearer {access_token}", "Client-Id": client_id}

    def is_configured(self) -> bool:
        client_id, client_secret = self._client()
        return bool(client_id and client_secret)

    def get_authorization_url(self, state: str, redirect_uri: str) -> str:
        client_id, _ = self._client()
        if not client_id:
            raise ProviderNotConfiguredError(
                "Streaming account connection is not configured in this development environment."
            )
        params = urlencode(
            {
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "channel:read:stream_key channel:manage:broadcast",
                "state": state,
            }
        )
        return f"https://id.twitch.tv/oauth2/authorize?{params}"

    def handle_callback(self, code: str, redirect_uri: str) -> dict:
        client_id, client_secret = self._client()
        response = httpx.post(
            "https://id.twitch.tv/oauth2/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
            timeout=15.0,
        )
        response.raise_for_status()
        return response.json()

    def refresh_token(self, refresh_token: str) -> dict:
        client_id, client_secret = self._client()
        response = httpx.post(
            "https://id.twitch.tv/oauth2/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            timeout=15.0,
        )
        response.raise_for_status()
        return response.json()

    def _broadcaster_id(self, access_token: str) -> str:
        response = httpx.get(
            "https://api.twitch.tv/helix/users",
            headers=self._api_headers(access_token),
            timeout=12.0,
        )
        response.raise_for_status()
        data = response.json().get("data") or []
        if not data:
            raise ValueError("Twitch user not found.")
        return str(data[0]["id"])

    def validate_rtmp_readiness(
        self,
        *,
        access_token: str | None = None,
        stream_url: str | None = None,
        stream_key: str | None = None,
        settings: dict | None = None,
    ) -> ProviderValidationResult:
        if not access_token:
            return ProviderValidationResult(ok=False, status="error", checks=[], safe_user_message="Twitch is not connected.")
        try:
            broadcaster_id = self._broadcaster_id(access_token)
            response = httpx.get(
                "https://api.twitch.tv/helix/streams/key",
                params={"broadcaster_id": broadcaster_id},
                headers=self._api_headers(access_token),
                timeout=12.0,
            )
            if response.status_code == 401:
                return ProviderValidationResult(
                    ok=False,
                    status="error",
                    checks=[check("rtmp_ready", "RTMP ready", False, "Twitch token expired.", severity="critical")],
                    safe_user_message="Twitch permission expired. Reconnect Twitch.",
                )
            if response.status_code == 403:
                return ProviderValidationResult(
                    ok=False,
                    status="error",
                    checks=[check("rtmp_ready", "RTMP ready", False, "Twitch stream key permission missing.", severity="critical")],
                    safe_user_message="Twitch needs permission to read your stream key. Reconnect Twitch.",
                )
            data = response.json().get("data") or []
            key_ok = bool(data and data[0].get("stream_key"))
            return ProviderValidationResult(
                ok=key_ok,
                status="ready" if key_ok else "needs_attention",
                checks=[
                    check("channel_exists", "Channel exists", True, "Twitch channel found."),
                    check("rtmp_ready", "RTMP ready", key_ok, "Twitch ingest server and stream key are available." if key_ok else "Twitch stream key is not available.", severity="critical" if not key_ok else "info"),
                ],
                safe_user_message="RTMP ready." if key_ok else "Twitch stream key is not available.",
            )
        except Exception as exc:
            return ProviderValidationResult(
                ok=False,
                status="error",
                checks=[check("rtmp_ready", "RTMP ready", False, str(exc), severity="critical")],
                safe_user_message="Could not verify Twitch streaming readiness.",
                technical_error=str(exc),
            )

    def test_connection(self, access_token: str | None = None, stream_url: str | None = None, stream_key: str | None = None, settings: dict | None = None, **kwargs):
        return super().test_connection(access_token=access_token, stream_url=stream_url, stream_key=stream_key, settings=settings, **kwargs)

    def get_account_info(self, access_token: str) -> ProviderAccountInfo:
        response = httpx.get("https://api.twitch.tv/helix/users", headers=self._api_headers(access_token), timeout=12.0)
        response.raise_for_status()
        data = response.json().get("data") or []
        if not data:
            return ProviderAccountInfo(account_name="Twitch Channel", permissions=["channel:read:stream_key"])
        user = data[0]
        return ProviderAccountInfo(
            account_name=str(user.get("display_name") or user.get("login") or "Twitch Channel"),
            channel_id=str(user.get("id") or ""),
            channel_name=str(user.get("display_name") or ""),
            profile_image_url=str(user.get("profile_image_url") or "") or None,
            permissions=["channel:read:stream_key", "channel:manage:broadcast"],
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
    ) -> dict:
        broadcaster_id = self._broadcaster_id(access_token)
        response = httpx.get(
            "https://api.twitch.tv/helix/streams/key",
            params={"broadcaster_id": broadcaster_id},
            headers=self._api_headers(access_token),
            timeout=15.0,
        )
        response.raise_for_status()
        data = response.json().get("data") or []
        if not data:
            raise ValueError("Unable to retrieve Twitch stream key.")
        stream_key_value = str(data[0].get("stream_key") or "")
        return {
            "prepared": True,
            "broadcastId": broadcaster_id,
            "ingestionAddress": "rtmp://live.twitch.tv/app",
            "streamName": stream_key_value,
        }

    def start_broadcast(
        self,
        access_token: str,
        broadcast_id: str | None = None,
        *,
        stream_url: str | None = None,
        stream_key: str | None = None,
        settings: dict | None = None,
        destination_id: str | None = None,
    ) -> dict:
        broadcaster_id = broadcast_id or self._broadcaster_id(access_token)
        response = httpx.get(
            "https://api.twitch.tv/helix/streams",
            params={"user_id": broadcaster_id},
            headers=self._api_headers(access_token),
            timeout=15.0,
        )
        response.raise_for_status()
        live = response.json().get("data") or []
        if live:
            return {"started": True, "broadcastId": broadcaster_id, "live": True}
        return {
            "started": False,
            "broadcastId": broadcaster_id,
            "message": "Twitch stream is not live yet. Start your encoder with the Twitch stream key.",
        }

    def stop_broadcast(
        self,
        access_token: str,
        broadcast_id: str | None = None,
        *,
        stream_url: str | None = None,
        stream_key: str | None = None,
        settings: dict | None = None,
        destination_id: str | None = None,
    ) -> dict:
        return {"stopped": True, "broadcastId": broadcast_id, "message": "Stop your encoder to end the Twitch stream."}
