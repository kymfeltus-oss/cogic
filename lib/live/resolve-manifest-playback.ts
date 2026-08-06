import { isValidHlsUrl } from "@/lib/live/hls";
import { fetchManifestStreamConfig } from "@/lib/live/fetch-manifest-stream-config";
import {
  resolveAttendeePlaybackFromEnv,
  resolvePrimaryAttendeePlaybackFromEnv,
} from "@/lib/live/manifest-dev-fallback";
import {
  resolveActiveFeedPlaybackUrl,
  resolvePrimaryFeedUrl,
} from "@/lib/owner/feed-urls";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type ResolvedManifestPlayback = {
  playbackUrl: string | null;
  activeSource: "primary" | "backup";
  fromDatabase: boolean;
};

/**
 * Resolve attendee HLS manifest for /api/stream/manifest.
 * When live, honors live_stream_state.active_source and dual feed URLs.
 */
export async function resolveLiveManifestPlayback(): Promise<ResolvedManifestPlayback> {
  const admin = getSupabaseAdmin();
  const { config } = await fetchManifestStreamConfig(admin);

  if (config?.is_live) {
    const { url, activeSource } = resolveActiveFeedPlaybackUrl({
      primary_playback_url: config.primary_playback_url,
      backup_playback_url: config.backup_playback_url,
      playback_url: config.playback_url,
      active_source: config.active_source,
      is_live: true,
    });

    if (url && isValidHlsUrl(url)) {
      return {
        playbackUrl: url,
        activeSource: activeSource === "backup" ? "backup" : "primary",
        fromDatabase: true,
      };
    }
  }

  if (config?.is_live) {
    const envPrimary =
      resolvePrimaryAttendeePlaybackFromEnv() ?? resolveAttendeePlaybackFromEnv();
    if (envPrimary && isValidHlsUrl(envPrimary)) {
      return {
        playbackUrl: envPrimary,
        activeSource: "primary",
        fromDatabase: false,
      };
    }

    const primaryOnly = resolvePrimaryFeedUrl({
      primary_playback_url: config.primary_playback_url,
      playback_url: config.playback_url,
    });
    if (primaryOnly && isValidHlsUrl(primaryOnly)) {
      return {
        playbackUrl: primaryOnly,
        activeSource: "primary",
        fromDatabase: true,
      };
    }
  }

  return { playbackUrl: null, activeSource: "primary", fromDatabase: false };
}
