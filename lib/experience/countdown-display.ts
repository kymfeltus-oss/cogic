import type { EventCountdownConfig, EventCountdownPhase } from "@/lib/live/countdown-config";
import type { CountdownParts } from "@/lib/live/event-lobby";

export const COUNTDOWN_STARTING_SHORTLY_LABEL = "STARTING SHORTLY";

/** Parse event start time; returns null when the timestamp is missing or invalid. */
export function parseCountdownStartMs(iso: string | undefined | null): number | null {
  if (!iso?.trim()) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** True when countdown config was loaded from persisted event_countdown_config (not code defaults). */
export function hasPersistedCountdownConfig(config: EventCountdownConfig): boolean {
  return Boolean(config.id?.trim());
}

/** Scheduled start passed but broadcast has not opened yet. */
export function isCountdownStartingShortly(
  countdown: CountdownParts,
  eventPhase: EventCountdownPhase,
): boolean {
  return countdown.isComplete && eventPhase === "waiting";
}

export function getCountdownAriaLabel(
  countdown: CountdownParts,
  eventPhase: EventCountdownPhase,
  options: { isLoading?: boolean; hasStartTime?: boolean } = {},
): string {
  if (options.isLoading) return "Loading event countdown";
  if (options.hasStartTime === false) return "Event countdown unavailable";
  if (isCountdownStartingShortly(countdown, eventPhase)) return COUNTDOWN_STARTING_SHORTLY_LABEL;
  if (countdown.isComplete) return "Event starting now";
  return `${countdown.days} days, ${countdown.hours} hours, ${countdown.minutes} minutes, ${countdown.seconds} seconds until live`;
}

/** Show numeric countdown only when a real persisted start time exists. */
export function shouldShowCountdownTimer(
  config: EventCountdownConfig,
  countdownLoading: boolean,
): boolean {
  if (countdownLoading) return false;
  if (!hasPersistedCountdownConfig(config)) return false;
  return parseCountdownStartMs(config.start_time) !== null;
}
