export type AttendeeMediaState =
  | { kind: "live"; badge: "LIVE NOW"; cta: "WATCH LIVE" }
  | { kind: "replay"; badge: "PLAYING NOW"; cta: "WATCH NOW" }
  | { kind: "offline"; badge: "OFFLINE"; cta: null };

/** A real live broadcast always wins over an attendee-playable published replay. */
export function resolveAttendeeMediaState(
  activeLiveStream: boolean,
  replay: { playbackUrl: string } | null | undefined,
  hasPlayablePreview = false,
): AttendeeMediaState {
  if (activeLiveStream) return { kind: "live", badge: "LIVE NOW", cta: "WATCH LIVE" };
  if (replay?.playbackUrl.trim() || hasPlayablePreview) {
    return { kind: "replay", badge: "PLAYING NOW", cta: "WATCH NOW" };
  }
  return { kind: "offline", badge: "OFFLINE", cta: null };
}
