import type { SupabaseClient } from "@supabase/supabase-js";
import { LIVE_STREAM_STATE_ID, type BroadcastCurrentState } from "@/lib/live/types";
import type { PlaybackStatus, PublishMode, PublishStatus } from "@/lib/owner/contracts";

export type OwnerStreamStateRow = {
  id: string;
  is_live: boolean;
  current_state: BroadcastCurrentState;
  imminent_live_started_at: string | null;
  playback_url: string | null;
  active_source: string | null;
  primary_playback_url: string | null;
  backup_playback_url: string | null;
  publish_mode: PublishMode | null;
  publish_status: PublishStatus | null;
  playback_status: PlaybackStatus | null;
  publish_error_message: string | null;
  playback_error_message: string | null;
  publisher_session_id: string | null;
  publisher_channel: string | null;
  concert_title: string;
  headliner_name: string;
  ticket_capacity_limit: number;
  gates_locked: boolean;
  audio_master_presets: Record<string, unknown>;
  updated_at: string | null;
  updated_by: string | null;
};

const SELECT_OWNER_WITH_FEEDS =
  "id, is_live, current_state, imminent_live_started_at, playback_url, active_source, primary_playback_url, backup_playback_url, publish_mode, publish_status, playback_status, publish_error_message, playback_error_message, publisher_session_id, publisher_channel, concert_title, headliner_name, ticket_capacity_limit, gates_locked, audio_master_presets, updated_at, updated_by";

const SELECT_OWNER_FULL =
  "id, is_live, current_state, imminent_live_started_at, playback_url, active_source, publish_mode, publish_status, playback_status, publish_error_message, playback_error_message, publisher_session_id, publisher_channel, updated_at, updated_by";

const SELECT_OWNER_LEGACY = "id, is_live, playback_url, active_source, updated_at, updated_by";

function isMissingColumnError(message: string): boolean {
  return /column .+ does not exist/i.test(message) || message.includes("42703");
}

function normalizePublishMode(raw: unknown): PublishMode {
  if (
    raw === "external_hls" ||
    raw === "rtmp_encoder" ||
    raw === "browser_camera"
  ) {
    return raw;
  }
  return "none";
}

function normalizePublishStatus(raw: unknown, isLive: boolean): PublishStatus {
  if (
    raw === "preflight" ||
    raw === "starting" ||
    raw === "publishing" ||
    raw === "ending" ||
    raw === "error"
  ) {
    return raw;
  }
  if (isLive) return "publishing";
  return "offline";
}

function normalizePlaybackStatus(raw: unknown, isLive: boolean): PlaybackStatus {
  if (
    raw === "ready" ||
    raw === "playback_pending" ||
    raw === "live" ||
    raw === "error"
  ) {
    return raw;
  }
  if (isLive) return "playback_pending";
  return "unconfigured";
}

function normalizeCurrentState(raw: unknown, isLive: boolean): BroadcastCurrentState {
  if (raw === "scheduled" || raw === "imminent_live" || raw === "live" || raw === "offline") {
    return raw;
  }
  if (isLive) return "live";
  return "offline";
}

function normalizeRow(row: Record<string, unknown>): OwnerStreamStateRow {
  const is_live = row.is_live === true;

  return {
    id: typeof row.id === "string" ? row.id : LIVE_STREAM_STATE_ID,
    is_live,
    current_state: normalizeCurrentState(row.current_state, is_live),
    imminent_live_started_at:
      typeof row.imminent_live_started_at === "string" ? row.imminent_live_started_at : null,
    playback_url: typeof row.playback_url === "string" ? row.playback_url : null,
    active_source: typeof row.active_source === "string" ? row.active_source : null,
    primary_playback_url:
      typeof row.primary_playback_url === "string" ? row.primary_playback_url : null,
    backup_playback_url:
      typeof row.backup_playback_url === "string" ? row.backup_playback_url : null,
    publish_mode: normalizePublishMode(row.publish_mode),
    publish_status: normalizePublishStatus(row.publish_status, is_live),
    playback_status: normalizePlaybackStatus(row.playback_status, is_live),
    publish_error_message:
      typeof row.publish_error_message === "string" ? row.publish_error_message : null,
    playback_error_message:
      typeof row.playback_error_message === "string" ? row.playback_error_message : null,
    publisher_session_id:
      typeof row.publisher_session_id === "string" ? row.publisher_session_id : null,
    publisher_channel:
      typeof row.publisher_channel === "string" ? row.publisher_channel : null,
    concert_title:
      typeof row.concert_title === "string" && row.concert_title.trim()
        ? row.concert_title
        : "The Awakening Experience",
    headliner_name:
      typeof row.headliner_name === "string" && row.headliner_name.trim()
        ? row.headliner_name
        : "Pastor David Jenkins",
    ticket_capacity_limit:
      typeof row.ticket_capacity_limit === "number" && Number.isFinite(row.ticket_capacity_limit)
        ? row.ticket_capacity_limit
        : 500,
    gates_locked: row.gates_locked === true,
    audio_master_presets:
      row.audio_master_presets && typeof row.audio_master_presets === "object"
        ? (row.audio_master_presets as Record<string, unknown>)
        : {},
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
    updated_by: typeof row.updated_by === "string" ? row.updated_by : null,
  };
}

export async function loadOwnerStreamState(
  admin: SupabaseClient,
): Promise<{ row: OwnerStreamStateRow | null; error: string | null }> {
  for (const selectClause of [SELECT_OWNER_WITH_FEEDS, SELECT_OWNER_FULL, SELECT_OWNER_LEGACY]) {
    const { data, error } = await admin
      .from("live_stream_state")
      .select(selectClause)
      .eq("id", LIVE_STREAM_STATE_ID)
      .maybeSingle();

    if (!error) {
      return {
        row: data ? normalizeRow(data as unknown as Record<string, unknown>) : null,
        error: null,
      };
    }

    if (!isMissingColumnError(error.message)) {
      return { row: null, error: error.message };
    }
  }

  return { row: null, error: "live_stream_state schema incompatible with owner routes." };
}

export async function updateOwnerStreamState(
  admin: SupabaseClient,
  patch: Record<string, unknown>,
): Promise<{ row: OwnerStreamStateRow | null; error: string | null }> {
  const payload = {
    ...patch,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("live_stream_state")
    .update(payload)
    .eq("id", LIVE_STREAM_STATE_ID)
    .select(SELECT_OWNER_WITH_FEEDS)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error.message)) {
      const legacyPatch: Record<string, unknown> = {};
      if ("is_live" in patch) legacyPatch.is_live = patch.is_live;
      if ("current_state" in patch) legacyPatch.current_state = patch.current_state;
      if ("imminent_live_started_at" in patch) {
        legacyPatch.imminent_live_started_at = patch.imminent_live_started_at;
      }
      if ("playback_url" in patch) legacyPatch.playback_url = patch.playback_url;
      if ("active_source" in patch) legacyPatch.active_source = patch.active_source;
      if ("primary_playback_url" in patch) legacyPatch.primary_playback_url = patch.primary_playback_url;
      if ("backup_playback_url" in patch) legacyPatch.backup_playback_url = patch.backup_playback_url;
      if ("updated_by" in patch) legacyPatch.updated_by = patch.updated_by;
      legacyPatch.updated_at = payload.updated_at;

      const legacy = await admin
        .from("live_stream_state")
        .update(legacyPatch)
        .eq("id", LIVE_STREAM_STATE_ID)
        .select(SELECT_OWNER_LEGACY)
        .maybeSingle();

      if (legacy.error) return { row: null, error: legacy.error.message };
      return {
        row: legacy.data ? normalizeRow(legacy.data as unknown as Record<string, unknown>) : null,
        error: null,
      };
    }

    return { row: null, error: error.message };
  }

  return {
    row: data ? normalizeRow(data as unknown as Record<string, unknown>) : null,
    error: null,
  };
}
