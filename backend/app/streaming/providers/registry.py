from __future__ import annotations

from app.streaming.providers.base_provider import BaseStreamingProvider, ProviderNotConfiguredError
from app.streaming.providers.custom_rtmp_provider import ChurchWebsiteProvider, CustomRtmpProvider
from app.streaming.providers.facebook_provider import FacebookProvider
from app.streaming.providers.twitch_provider import TwitchProvider
from app.streaming.providers.vimeo_provider import VimeoProvider
from app.streaming.providers.youtube_provider import YouTubeProvider

_PROVIDERS: dict[str, BaseStreamingProvider] = {
    "youtube": YouTubeProvider(),
    "facebook": FacebookProvider(),
    "vimeo": VimeoProvider(),
    "twitch": TwitchProvider(),
    "custom_rtmp": CustomRtmpProvider(),
    "church_website": ChurchWebsiteProvider(),
    "website": ChurchWebsiteProvider(),
}


def get_provider(provider_id: str) -> BaseStreamingProvider:
    provider = _PROVIDERS.get(provider_id)
    if not provider:
        raise ProviderNotConfiguredError(f"Unsupported streaming platform: {provider_id}")
    return provider


def provider_configured(provider_id: str) -> bool:
    return get_provider(provider_id).is_configured()
