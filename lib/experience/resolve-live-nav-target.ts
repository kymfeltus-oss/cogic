import {
  EXPERIENCE_LIVE_PATH,
  PUBLIC_COUNTDOWN_PATH,
} from "@/lib/experience/live-routes";

export type AttendeeLiveNavTarget = typeof EXPERIENCE_LIVE_PATH | typeof PUBLIC_COUNTDOWN_PATH;

/** Attendee Live navigation always resolves to `/live`. */
export function resolveAttendeeLiveNavTarget(
  _startIso?: string,
  _endIso?: string,
  _options?: Record<string, unknown>,
): AttendeeLiveNavTarget {
  return EXPERIENCE_LIVE_PATH;
}
