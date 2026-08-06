import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE_STREAM_STATE_ID } from "@/lib/live/types";

export type ManifestStreamSource = "primary" | "backup" | "offline";

export type ManifestStreamConfig = {
  is_live: boolean;
  active_source: ManifestStreamSource;
  playback_url: string | null;
  primary_playback_url: string | null;
  backup_playback_url: string | null;
  camera_preview_hls_url: string | null;
};

const SELECT_MANIFEST_FULL =
  "is_live, active_source, playback_url, primary_playback_url, backup_playback_url, camera_preview_hls_url";

const SELECT_MANIFEST_STANDARD =
  "is_live, active_source, playback_url, primary_playback_url, backup_playback_url";

const SELECT_MANIFEST_BASE = "is_live, active_source, playback_url";

const SELECT_MANIFEST_LEGACY = "is_live, playback_url";

function isMissingColumnError(message: string): boolean {
  return /column .+ does not exist/i.test(message) || message.includes("42703");
}

function normalizeActiveSource(
  raw: unknown,
  isLive: boolean,
): ManifestStreamSource {
  if (raw === "primary" || raw === "backup" || raw === "offline") {
    return raw;
  }
  return isLive ? "primary" : "offline";
}

function normalizeManifestStreamConfig(
  row: Record<string, unknown> | null,
): ManifestStreamConfig | null {
  if (!row) return null;

  const is_live = row.is_live === true;

  return {
    is_live,
    active_source: normalizeActiveSource(row.active_source, is_live),
    playback_url: typeof row.playback_url === "string" ? row.playback_url : null,
    primary_playback_url:
      typeof row.primary_playback_url === "string" ? row.primary_playback_url : null,
    backup_playback_url:
      typeof row.backup_playback_url === "string" ? row.backup_playback_url : null,
    camera_preview_hls_url:
      typeof row.camera_preview_hls_url === "string" ? row.camera_preview_hls_url : null,
  };
}

/**
 * Load manifest stream config with progressive column fallback when migrations
 * (0011–0014) are not fully applied on the target database.
 */
export async function fetchManifestStreamConfig(
  admin: SupabaseClient,
): Promise<{ config: ManifestStreamConfig | null; error: string | null; selectUsed: string | null }> {
  const selects = [
    SELECT_MANIFEST_FULL,
    SELECT_MANIFEST_STANDARD,
    SELECT_MANIFEST_BASE,
    SELECT_MANIFEST_LEGACY,
  ];

  for (const selectClause of selects) {
    const { data, error } = await admin
      .from("live_stream_state")
      .select(selectClause)
      .eq("id", LIVE_STREAM_STATE_ID)
      .maybeSingle();

    if (!error) {
      return {
        config: normalizeManifestStreamConfig(
          data as unknown as Record<string, unknown> | null,
        ),
        error: null,
        selectUsed: selectClause,
      };
    }

    if (!isMissingColumnError(error.message)) {
      return { config: null, error: error.message, selectUsed: null };
    }
  }

  return {
    config: null,
    error: "live_stream_state schema incompatible with manifest route.",
    selectUsed: null,
  };
}
