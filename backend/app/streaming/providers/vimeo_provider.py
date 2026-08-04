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


class VimeoProvider(BaseStreamingProvider):
    provider_id = "vimeo"

    def _client(self) -> tuple[str, str]:
        return os.getenv("VIMEO_CLIENT_ID", "").strip(), os.getenv("VIMEO_CLIENT_SECRET", "").strip()

    def _headers(self, access_token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.vimeo.*+json;version=3.4"}

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
                "state": state,
                "scope": "public private",
            }
        )
        return f"https://api.vimeo.com/oauth/authorize?{params}"

    def handle_callback(self, code: str, redirect_uri: str) -> dict:
        client_id, client_secret = self._client()
        response = httpx.post(
            "https://api.vimeo.com/oauth/access_token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
            },
            auth=(client_id, client_secret),
            timeout=15.0,
        )
        response.raise_for_status()
        return response.json()

    def refresh_token(self, refresh_token: str) -> dict:
        client_id, client_secret = self._client()
        response = httpx.post(
            "https://api.vimeo.com/oauth/access_token",
            data={"grant_type": "refresh_token", "refresh_token": refresh_token},
            auth=(client_id, client_secret),
            timeout=15.0,
        )
        response.raise_for_status()
        return response.json()

    def validate_live_capability(self, *, access_token: str | None = None, settings: dict | None = None) -> ProviderValidationResult:
        if not access_token:
            return ProviderValidationResult(ok=False, status="error", checks=[], safe_user_message="Vimeo is not connected.")
        try:
            response = httpx.get("https://api.vimeo.com/me", headers=self._headers(access_token), timeout=12.0)
            if response.status_code != 200:
                return ProviderValidationResult(
                    ok=False,
                    status="error",
                    checks=[check("live_capability", "Livestreaming enabled", False, "Vimeo account could not be verified.", severity="critical")],
                    safe_user_message="Vimeo connection expired. Please reconnect.",
                )
            payload = response.json()
            capabilities = payload.get("capabilities") or {}
            live_cap = capabilities.get("live") or {}
            has_live = bool(live_cap.get("streaming"))
            if not has_live:
                return ProviderValidationResult(
                    ok=False,
                    status="error",
                    checks=[check("live_capability", "Livestreaming enabled", False, "This Vimeo account does not currently support livestreaming.", severity="critical")],
                    safe_user_message="This Vimeo account does not currently support livestreaming.",
                )
            return ProviderValidationResult(
                ok=True,
                status="ready",
                checks=[check("live_capability", "Livestreaming enabled", True, "Vimeo livestreaming is available on this account.")],
                safe_user_message="Livestreaming enabled.",
            )
        except httpx.HTTPError as exc:
            return ProviderValidationResult(
                ok=False,
                status="error",
                checks=[check("live_capability", "Livestreaming enabled", False, "Could not reach Vimeo.", severity="critical")],
                safe_user_message="Could not reach Vimeo.",
                technical_error=str(exc),
            )

    def test_connection(self, access_token: str | None = None, stream_url: str | None = None, stream_key: str | None = None, settings: dict | None = None, **kwargs):
        return super().test_connection(access_token=access_token, stream_url=stream_url, stream_key=stream_key, settings=settings, **kwargs)

    def get_account_info(self, access_token: str) -> ProviderAccountInfo:
        response = httpx.get("https://api.vimeo.com/me", headers=self._headers(access_token), timeout=12.0)
        response.raise_for_status()
        payload = response.json()
        pictures = payload.get("pictures") or {}
        sizes = pictures.get("sizes") or []
        thumb = sizes[0].get("link") if sizes else None
        return ProviderAccountInfo(
            account_name=str(payload.get("name") or "Vimeo Account"),
            account_email=str((payload.get("metadata") or {}).get("connections", {}).get("email") or "") or None,
            channel_id=str(payload.get("uri") or "").replace("/users/", ""),
            channel_name=str(payload.get("name") or ""),
            profile_image_url=str(thumb or "") or None,
            permissions=["public", "private"],
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
        response = httpx.post(
            "https://api.vimeo.com/me/live_events",
            headers=self._headers(access_token),
            json={
                "title": title or "Live Service",
                "stream_title": title or "Live Service",
                "stream_description": description or "",
                "stream_privacy": {"view": "anybody"},
            },
            timeout=20.0,
        )
        response.raise_for_status()
        payload = response.json()
        stream = payload.get("stream") or {}
        event_uri = str(payload.get("uri") or "")
        event_id = event_uri.rsplit("/", 1)[-1] if event_uri else ""
        return {
            "prepared": True,
            "broadcastId": event_id,
            "ingestionAddress": stream.get("rtmp_link"),
            "streamName": stream.get("stream_key"),
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
        if not broadcast_id:
            raise ValueError("No prepared Vimeo live event found.")
        response = httpx.post(
            f"https://api.vimeo.com/me/live_events/{broadcast_id}/activate",
            headers=self._headers(access_token),
            timeout=20.0,
        )
        response.raise_for_status()
        return {"started": True, "broadcastId": broadcast_id}

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
        if not broadcast_id:
            return {"stopped": True, "message": "No active Vimeo live event."}
        response = httpx.post(
            f"https://api.vimeo.com/me/live_events/{broadcast_id}/end",
            headers=self._headers(access_token),
            timeout=20.0,
        )
        if response.status_code >= 400:
            response.raise_for_status()
        return {"stopped": True, "broadcastId": broadcast_id}
