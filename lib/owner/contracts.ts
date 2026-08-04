/** Owner broadcast control contracts — see docs/owner-broadcast-contract.md */

import type { VmixSnapshot } from "@/lib/owner/vmix/client";

export type EventPhase =
  | "idle"
  | "scheduled"
  | "preshow"
  | "live"
  | "ended";

export type EventPhaseState = {
  phase: EventPhase;
  startTime: string | null;
  endTime: string | null;
  scheduleTimezone: string | null;
};

export type PublishMode = "none" | "external_hls" | "rtmp_encoder" | "browser_camera";

export type PublishStatus =
  | "offline"
  | "preflight"
  | "starting"
  | "publishing"
  | "ending"
  | "error";

export type PublishState = {
  mode: PublishMode;
  status: PublishStatus;
  errorMessage: string | null;
};

export type PlaybackStatus =
  | "unconfigured"
  | "ready"
  | "playback_pending"
  | "live"
  | "error";

export type PlaybackState = {
  status: PlaybackStatus;
  /** Public HLS manifest only — never ingest or stream keys. */
  hlsUrl: string | null;
  manifestReachable: boolean;
  errorMessage: string | null;
};

export type PreflightCheckStatus = "pass" | "warn" | "fail" | "skipped";

export type PreflightCheck = {
  id: string;
  label: string;
  status: PreflightCheckStatus;
  detail?: string;
};

export type ActiveFeedSource = "primary" | "backup" | "offline";

export type FeedLaneState = {
  hlsUrl: string | null;
  manifestReachable: boolean;
  detail: string | null;
};

/** Dual-ingest hot redundancy — primary (Restream) and backup (IVS) lanes. */
export type FeedState = {
  activeSource: ActiveFeedSource;
  primary: FeedLaneState;
  backup: FeedLaneState;
};

export type OwnerBroadcastSnapshot = {
  capturedAt: string;
  eventPhase: EventPhaseState;
  publish: PublishState;
  playback: PlaybackState;
  feed: FeedState;
  preflight: PreflightCheck[];
  publisherSessionId: string | null;
  publisherChannel: string | null;
  vmix: VmixSnapshot | null;
};

export type OwnerPublisherSession = {
  sessionId: string;
  channel: string;
  browserChannel: string;
  expiresAt: string;
};

export type GoLiveRequestBody = {
  mode: Exclude<PublishMode, "none">;
  confirm?: boolean;
};

export type SwitchFeedRequestBody = {
  source: "primary" | "backup";
  confirm?: boolean;
};

export const OWNER_PUBLISH_MODES: readonly PublishMode[] = [
  "none",
  "external_hls",
  "rtmp_encoder",
  "browser_camera",
] as const;

export const OWNER_PUBLISH_STATUSES: readonly PublishStatus[] = [
  "offline",
  "preflight",
  "starting",
  "publishing",
  "ending",
  "error",
] as const;

export const OWNER_PLAYBACK_STATUSES: readonly PlaybackStatus[] = [
  "unconfigured",
  "ready",
  "playback_pending",
  "live",
  "error",
] as const;
