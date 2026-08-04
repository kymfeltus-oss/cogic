import type { BroadcastCurrentState } from "@/lib/live/types";
import { LIVE_STREAM_STATE_ID } from "@/lib/live/types";

/** Stream IDs that resolve to the singleton live_stream_state row. */
export const KNOWN_ATTENDEE_STREAM_IDS = [
  LIVE_STREAM_STATE_ID,
  "current",
  "main",
  "main_stage",
] as const;

export type AttendeeBroadcastStatus =
  | "loading"
  | "scheduled"
  | "starting_soon"
  | "live"
  | "offline"
  | "unavailable"
  | "error";

export function isKnownAttendeeStreamId(streamId: string | null | undefined): boolean {
  const normalized = streamId?.trim().toLowerCase() ?? "";
  if (!normalized) return false;
  return (KNOWN_ATTENDEE_STREAM_IDS as readonly string[]).includes(normalized);
}

export function mapBroadcastStateToAttendeeStatus(
  currentState: BroadcastCurrentState | null | undefined,
  isLive: boolean,
): Exclude<AttendeeBroadcastStatus, "loading" | "error" | "unavailable"> {
  if (isLive || currentState === "live") return "live";
  if (currentState === "imminent_live") return "starting_soon";
  if (currentState === "scheduled") return "scheduled";
  return "offline";
}

export function attendeeStatusMessage(status: AttendeeBroadcastStatus): string {
  switch (status) {
    case "loading":
      return "Checking for a live broadcast.";
    case "scheduled":
      return "The broadcast is scheduled. It is not live yet.";
    case "starting_soon":
      return "The broadcast is starting soon.";
    case "live":
      return "Connecting to the live broadcast.";
    case "offline":
      return "No broadcasts are live right now.";
    case "unavailable":
      return "This broadcast is unavailable.";
    case "error":
      return "Live playback is temporarily unavailable. Try again.";
  }
}

/** True when a viewer metric is production-backed (presence > 0). Never invent totals. */
export function shouldDisplayViewerCount(actualPresenceCount: number): boolean {
  return Number.isFinite(actualPresenceCount) && actualPresenceCount > 0;
}
