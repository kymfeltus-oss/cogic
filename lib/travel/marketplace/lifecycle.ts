export type MarketplaceAttemptStatus =
  | "booking_started"
  | "pending_confirmation"
  | "confirmed"
  | "canceled"
  | "failed";

/** Attempts left open without return/confirm longer than this are operationally stale. */
export const MARKETPLACE_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

const ALLOWED_TRANSITIONS: Record<MarketplaceAttemptStatus, MarketplaceAttemptStatus[]> = {
  booking_started: ["pending_confirmation", "confirmed", "canceled", "failed"],
  pending_confirmation: ["confirmed", "canceled", "failed", "pending_confirmation"],
  confirmed: [],
  canceled: [],
  failed: [],
};

export function assertMarketplaceTransition(
  from: MarketplaceAttemptStatus,
  to: MarketplaceAttemptStatus,
) {
  if (from === to) return;
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw new Error(`Invalid marketplace booking transition: ${from} → ${to}.`);
  }
}

export function isStaleMarketplaceAttempt(
  attempt: { status: MarketplaceAttemptStatus; started_at: string; updated_at: string },
  now = Date.now(),
) {
  if (attempt.status !== "booking_started" && attempt.status !== "pending_confirmation") {
    return false;
  }
  const anchor = new Date(attempt.updated_at || attempt.started_at).getTime();
  if (!Number.isFinite(anchor)) return false;
  return now - anchor >= MARKETPLACE_STALE_AFTER_MS;
}
