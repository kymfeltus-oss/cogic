import type { EventCountdownPhase } from "@/lib/live/countdown-config";

/** Time before show when `/live` opens the holding room (2 hours). */
export const HOLDING_ROOM_WINDOW_MS = 2 * 60 * 60 * 1000;

export type EventLifecycleStage = "announcement" | "holding" | "live" | "ended";

/** Schedule-only lifecycle from persisted countdown start/end times. */
export function computeEventLifecycleStage(
  startIso: string,
  endIso: string,
  nowMs = Date.now(),
): EventLifecycleStage {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return "announcement";
  }

  if (nowMs > endMs) return "ended";
  if (nowMs >= startMs) return "live";

  const holdingOpensAt = startMs - HOLDING_ROOM_WINDOW_MS;
  if (nowMs >= holdingOpensAt) return "holding";

  return "announcement";
}

export function isPreLiveLifecycleStage(stage: EventLifecycleStage): boolean {
  return stage === "announcement" || stage === "holding";
}

type ResolveAttendeeLifecycleOptions = {
  /** Ops/platform stream flag — early go-live wins over the 2-hour window. */
  broadcastIsLive?: boolean;
  /** Synced countdown phase from `/api/countdown` (live when schedule window is open). */
  countdownPhase?: EventCountdownPhase;
};

/**
 * Merge schedule lifecycle with broadcast/countdown overrides for attendee `/live` routing.
 */
export function resolveAttendeeLifecycleStage(
  scheduleStage: EventLifecycleStage,
  options: ResolveAttendeeLifecycleOptions = {},
): EventLifecycleStage {
  if (options.broadcastIsLive || options.countdownPhase === "live") {
    return "live";
  }
  return scheduleStage;
}
