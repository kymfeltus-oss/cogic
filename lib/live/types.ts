export type ChatMessageRow = {
  id: string;
  user_id: string;
  email: string;
  content: string;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};

export type HarvestProgressRow = {
  id: number;
  total_cents: number;
  updated_at: string;
};

export const LIVE_ROOM_CHAT_CHANNEL = "live-room-platform";
export const LIVE_ROOM_PLATFORM_CHANNEL = LIVE_ROOM_CHAT_CHANNEL;
export const LIVE_STREAM_STATE_BROADCAST_EVENT = "stream-state-sync";
export const HARVEST_METRICS_CHANNEL = LIVE_ROOM_PLATFORM_CHANNEL;
export const STREAM_STATE_SYNC_CHANNEL = LIVE_ROOM_PLATFORM_CHANNEL;
export const LIVE_STREAM_STATE_ID = "current_event";
export const HARVEST_GOAL_DOLLARS = 30_000;

export const IMMINENT_LIVE_START_EVENT = "imminent_live_start";
export const IMMINENT_LIVE_DURATION_SEC = 10;

export type StreamStateSyncPayload = {
  at?: string;
  event?: typeof IMMINENT_LIVE_START_EVENT | "pre_show_updated";
  durationSeconds?: number;
  dropStartedAt?: string;
};

export type BroadcastCurrentState = "offline" | "scheduled" | "imminent_live" | "live";

export type LiveStreamStateRow = {
  id: string;
  is_live: boolean;
  current_state: BroadcastCurrentState;
  imminent_live_started_at: string | null;
  playback_url: string;
  active_source: "offline" | "primary" | "backup";
  primary_playback_url: string | null;
  backup_playback_url: string | null;
  primary_rtmp_ingest_url: string | null;
  backup_rtmp_ingest_url: string | null;
  concert_title: string;
  headliner_name: string;
  ticket_capacity_limit: number;
  gates_locked: boolean;
  audio_master_presets: Record<string, unknown>;
  updated_at: string;
  updated_by: string | null;
};
