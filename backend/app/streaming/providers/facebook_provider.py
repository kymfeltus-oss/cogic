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
from app.streaming.providers.validation_helpers import check, merge_validation_results


class FacebookProvider(BaseStreamingProvider):
    provider_id = "facebook"

    def _client(self) -> tuple[str, str]:
        return os.getenv("FACEBOOK_CLIENT_ID", "").strip(), os.getenv("FACEBOOK_CLIENT_SECRET", "").strip()

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
                "state": state,
                "scope": "pages_show_list,pages_read_engagement,pages_manage_posts,publish_video",
                "response_type": "code",
            }
        )
        return f"https://www.facebook.com/v19.0/dialog/oauth?{params}"

    def handle_callback(self, code: str, redirect_uri: str) -> dict:
        client_id, client_secret = self._client()
        response = httpx.get(
            "https://graph.facebook.com/v19.0/oauth/access_token",
            params={
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "code": code,
            },
            timeout=15.0,
        )
        response.raise_for_status()
        return response.json()

    def validate_permissions(self, *, access_token: str | None = None, settings: dict | None = None) -> ProviderValidationResult:
        if not access_token:
            return ProviderValidationResult(ok=False, status="error", checks=[], safe_user_message="Facebook is not connected.")
        try:
            response = httpx.get(
                "https://graph.facebook.com/v19.0/me",
                params={"fields": "name", "access_token": access_token},
                timeout=12.0,
            )
            if response.status_code == 401:
                return ProviderValidationResult(
                    ok=False,
                    status="error",
                    checks=[check("permissions", "Permissions verified", False, "Facebook token expired.", severity="critical")],
                    safe_user_message="Facebook permission expired. Reconnect Facebook.",
                )
            page_ok = False
            page_message = "Facebook page not selected."
            page_id = ""
            try:
                page_id, page_token = self._resolve_page(access_token, settings)
                page_resp = httpx.get(
                    f"https://graph.facebook.com/v19.0/{page_id}",
                    params={"fields": "name", "access_token": page_token},
                    timeout=12.0,
                )
                page_ok = page_resp.status_code == 200
                page_message = "Facebook page is connected." if page_ok else "Facebook page could not be verified."
            except Exception as exc:
                page_message = str(exc)
            live_perm_ok = False
            if page_ok:
                try:
                    _, page_token = self._resolve_page(access_token, settings)
                    perm_resp = httpx.get(
                        f"https://graph.facebook.com/v19.0/{page_id}/permissions",
                        params={"access_token": page_token},
                        timeout=12.0,
                    )
                    if perm_resp.status_code == 200:
                        perms = {p.get("permission"): p.get("status") for p in perm_resp.json().get("data") or []}
                        live_perm_ok = perms.get("CREATE_CONTENT") == "granted" or perms.get("MANAGE") == "granted"
                except Exception:
                    live_perm_ok = False
            ok = response.status_code == 200 and page_ok and live_perm_ok
            return ProviderValidationResult(
                ok=ok,
                status="ready" if ok else "needs_attention",
                checks=[
                    check("permissions", "Permissions verified", response.status_code == 200, "Facebook account access confirmed." if response.status_code == 200 else "Facebook account access failed.", severity="critical" if response.status_code != 200 else "info"),
                    check("channel_exists", "Page selected", page_ok, page_message, severity="critical" if not page_ok else "info"),
                    check("live_permission", "Live video permission", live_perm_ok, "Facebook can create live videos for this page." if live_perm_ok else "Facebook needs permission to create live videos for this page.", severity="critical" if not live_perm_ok else "info"),
                ],
                safe_user_message="Facebook is ready to stream." if ok else "Facebook needs permission to create live videos for this page.",
            )
        except httpx.HTTPError as exc:
            return ProviderValidationResult(
                ok=False,
                status="error",
                checks=[check("permissions", "Permissions verified", False, "Could not reach Facebook.", severity="critical")],
                safe_user_message="Could not reach Facebook. Try again in a moment.",
                technical_error=str(exc),
            )

    def validate_live_capability(self, *, access_token: str | None = None, settings: dict | None = None) -> ProviderValidationResult:
        if not access_token:
            return ProviderValidationResult(ok=False, status="error", checks=[], safe_user_message="Facebook is not connected.")
        try:
            page_id, page_token = self._resolve_page(access_token, settings)
            response = httpx.get(
                f"https://graph.facebook.com/v19.0/{page_id}",
                params={"fields": "name,live_streaming_status", "access_token": page_token},
                timeout=12.0,
            )
            ok = response.status_code == 200
            return ProviderValidationResult(
                ok=ok,
                status="ready" if ok else "needs_attention",
                checks=[check("live_capability", "Livestreaming enabled", ok, "Facebook live streaming is available for this page." if ok else "Facebook live streaming is not available for this page.", severity="critical" if not ok else "info")],
                safe_user_message="Livestreaming enabled." if ok else "Facebook live streaming is not enabled for this page.",
            )
        except Exception as exc:
            return ProviderValidationResult(
                ok=False,
                status="error",
                checks=[check("live_capability", "Livestreaming enabled", False, str(exc), severity="critical")],
                safe_user_message="Facebook page could not be verified. Reconnect Facebook.",
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
            return ProviderValidationResult(ok=False, status="error", checks=[], safe_user_message="Facebook is not connected.")
        try:
            page_id, page_token = self._resolve_page(access_token, settings)
            response = httpx.post(
                f"https://graph.facebook.com/v19.0/{page_id}/live_videos",
                params={
                    "access_token": page_token,
                    "title": "Parable Readiness Check",
                    "status": "SCHEDULED_UNPUBLISHED",
                    "stop_on_delete": "true",
                },
                timeout=20.0,
            )
            if response.status_code >= 400:
                return ProviderValidationResult(
                    ok=False,
                    status="error",
                    checks=[check("rtmp_ready", "RTMP ready", False, "Facebook could not prepare a live video.", severity="critical")],
                    safe_user_message="Facebook could not prepare live streaming. Reconnect Facebook.",
                    technical_error=response.text,
                )
            payload = response.json()
            ingest_ok = bool(payload.get("stream_url") or payload.get("secure_stream_url"))
            if payload.get("id"):
                httpx.delete(
                    f"https://graph.facebook.com/v19.0/{payload['id']}",
                    params={"access_token": page_token},
                    timeout=12.0,
                )
            return ProviderValidationResult(
                ok=ingest_ok,
                status="ready" if ingest_ok else "needs_attention",
                checks=[check("broadcast_prepared", "Broadcast prepared", ingest_ok, "Facebook can prepare a live broadcast." if ingest_ok else "Facebook ingest endpoint is not ready.", severity="critical" if not ingest_ok else "info"), check("rtmp_ready", "RTMP ready", ingest_ok, "Facebook RTMP ingest is available." if ingest_ok else "Facebook RTMP ingest is not available.", severity="critical" if not ingest_ok else "info")],
                safe_user_message="RTMP ready." if ingest_ok else "Facebook ingest endpoint is not ready.",
            )
        except Exception as exc:
            return ProviderValidationResult(
                ok=False,
                status="error",
                checks=[check("rtmp_ready", "RTMP ready", False, str(exc), severity="critical")],
                safe_user_message="Facebook could not verify live streaming readiness.",
                technical_error=str(exc),
            )

    def test_connection(
        self,
        access_token: str | None = None,
        stream_url: str | None = None,
        stream_key: str | None = None,
        settings: dict | None = None,
        video_profile: dict | None = None,
        audio_profile: dict | None = None,
        privacy: str | None = None,
        scheduled_start_at: str | None = None,
    ):
        return super().test_connection(
            access_token=access_token,
            stream_url=stream_url,
            stream_key=stream_key,
            settings=settings,
            video_profile=video_profile,
            audio_profile=audio_profile,
            privacy=privacy,
            scheduled_start_at=scheduled_start_at,
        )

    def get_account_info(self, access_token: str) -> ProviderAccountInfo:
        me = httpx.get(
            "https://graph.facebook.com/v19.0/me",
            params={"fields": "name,email", "access_token": access_token},
            timeout=12.0,
        )
        me.raise_for_status()
        profile = me.json()
        try:
            page_id, _ = self._resolve_page(access_token, None)
            page_resp = httpx.get(
                f"https://graph.facebook.com/v19.0/{page_id}",
                params={"fields": "name,picture", "access_token": access_token},
                timeout=12.0,
            )
            page_resp.raise_for_status()
            page = page_resp.json()
            picture = (page.get("picture") or {}).get("data") or {}
            return ProviderAccountInfo(
                account_name=str(page.get("name") or profile.get("name") or "Facebook Page"),
                account_email=str(profile.get("email") or "") or None,
                channel_id=page_id,
                channel_name=str(page.get("name") or ""),
                profile_image_url=str(picture.get("url") or "") or None,
                permissions=["pages_show_list", "publish_video"],
            )
        except Exception:
            return ProviderAccountInfo(
                account_name=str(profile.get("name") or "Facebook Account"),
                account_email=str(profile.get("email") or "") or None,
                permissions=["pages_show_list", "publish_video"],
            )

    def refresh_token(self, refresh_token: str) -> dict:
        client_id, client_secret = self._client()
        response = httpx.get(
            "https://graph.facebook.com/v19.0/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": client_id,
                "client_secret": client_secret,
                "fb_exchange_token": refresh_token,
            },
            timeout=15.0,
        )
        response.raise_for_status()
        return response.json()

    def _resolve_page(self, access_token: str, settings: dict | None) -> tuple[str, str]:
        settings = settings or {}
        page_id = str(settings.get("pageId") or settings.get("facebookPageId") or "")
        if page_id:
            token_resp = httpx.get(
                f"https://graph.facebook.com/v19.0/{page_id}",
                params={"fields": "access_token,name", "access_token": access_token},
                timeout=12.0,
            )
            token_resp.raise_for_status()
            payload = token_resp.json()
            page_token = str(payload.get("access_token") or access_token)
            return page_id, page_token

        pages_resp = httpx.get(
            "https://graph.facebook.com/v19.0/me/accounts",
            params={"access_token": access_token, "fields": "id,name,access_token"},
            timeout=12.0,
        )
        pages_resp.raise_for_status()
        pages = pages_resp.json().get("data") or []
        if not pages:
            raise ValueError("No Facebook Pages found. Connect a Page with live streaming permission.")
        page = pages[0]
        return str(page["id"]), str(page.get("access_token") or access_token)

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
        page_id, page_token = self._resolve_page(access_token, settings)
        response = httpx.post(
            f"https://graph.facebook.com/v19.0/{page_id}/live_videos",
            params={
                "access_token": page_token,
                "title": title or "Live Service",
                "description": description or "",
                "status": "SCHEDULED_UNPUBLISHED",
            },
            timeout=20.0,
        )
        response.raise_for_status()
        payload = response.json()
        return {
            "prepared": True,
            "broadcastId": str(payload.get("id") or ""),
            "streamUrl": payload.get("stream_url"),
            "secureStreamUrl": payload.get("secure_stream_url"),
            "pageId": page_id,
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
            raise ValueError("No prepared Facebook live video found.")
        _, page_token = self._resolve_page(access_token, settings)
        response = httpx.post(
            f"https://graph.facebook.com/v19.0/{broadcast_id}",
            params={"access_token": page_token, "status": "LIVE_NOW"},
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
            return {"stopped": True, "message": "No active Facebook live video."}
        _, page_token = self._resolve_page(access_token, settings)
        response = httpx.post(
            f"https://graph.facebook.com/v19.0/{broadcast_id}",
            params={"access_token": page_token, "end_live_video": "true"},
            timeout=20.0,
        )
        if response.status_code >= 400:
            response.raise_for_status()
        return {"stopped": True, "broadcastId": broadcast_id}
