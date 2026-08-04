/** Minutes from now for a go-live preset button in ops schedule UI. */
export const GO_LIVE_PRESET_MINUTES = [30, 60, 90] as const;

export function buildGoLiveAtOffsetMinutes(
  minutesFromNow: number,
  nowMs = Date.now(),
): string {
  return new Date(nowMs + minutesFromNow * 60_000).toISOString();
}

/** Human-readable countdown remaining until go-live (`start_time`). */
export function formatCountdownUntilGoLive(
  goLiveIso: string,
  nowMs = Date.now(),
): string {
  const diffMs = new Date(goLiveIso).getTime() - nowMs;
  if (Number.isNaN(diffMs)) return "Set go-live time";
  if (diffMs <= 0) return "Go-live time has passed";

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  parts.push(`${hours}h`, `${minutes}m`, `${String(seconds).padStart(2, "0")}s`);
  return parts.join(" ");
}

/** Minutes until go-live — inside the 2-hour holding-room window on /live. */
const HOLDING_ROOM_START_OFFSET_MS = 90 * 60 * 1000;

const HOLDING_STREAM_HOURS = 4;

/** Build a near-term pre-show window so /live opens the holding room immediately. */
export function buildHoldingRoomScheduleNow(nowMs = Date.now()): {
  start_time: string;
  end_time: string;
} {
  const startMs = nowMs + HOLDING_ROOM_START_OFFSET_MS;
  const endMs = startMs + HOLDING_STREAM_HOURS * 60 * 60 * 1000;

  return {
    start_time: new Date(startMs).toISOString(),
    end_time: new Date(endMs).toISOString(),
  };
}

/** Build a far-future announcement window (public /countdown surface). */
export function buildFutureHoldingSchedule(nowMs = Date.now()): {
  start_time: string;
  end_time: string;
} {
  const start = new Date(nowMs);
  start.setDate(start.getDate() + 14);
  start.setHours(19, 30, 0, 0);

  const end = new Date(start);
  end.setHours(end.getHours() + HOLDING_STREAM_HOURS);

  return {
    start_time: start.toISOString(),
    end_time: end.toISOString(),
  };
}

/**
 * When start is already past but end is still future, derive a future go-live
 * from the end time so /live returns to the holding room.
 */
export function alignStartForHoldingRoom(
  startIso: string,
  endIso: string,
  nowMs = Date.now(),
): string | null {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= nowMs) return null;
  if (startMs >= nowMs) return null;

  const proposedStartMs = endMs - HOLDING_STREAM_HOURS * 60 * 60 * 1000;
  if (proposedStartMs > nowMs) {
    return new Date(proposedStartMs).toISOString();
  }

  const fallbackMs = nowMs + 5 * 60 * 1000;
  if (fallbackMs < endMs) {
    return new Date(fallbackMs).toISOString();
  }

  return null;
}
