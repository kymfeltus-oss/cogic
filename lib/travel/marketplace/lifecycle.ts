export type MarketplaceAttemptStatus =
  | "DRAFT"
  | "PAYMENT_PENDING"
  | "SUPPLIER_SUBMITTED"
  | "CONFIRMED"
  | "FAILED"
  | "REFUNDED";

/** Attempts left open without payment/supplier progress longer than this are operationally stale. */
export const MARKETPLACE_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

const ALLOWED_TRANSITIONS: Record<MarketplaceAttemptStatus, MarketplaceAttemptStatus[]> = {
  DRAFT: ["PAYMENT_PENDING", "SUPPLIER_SUBMITTED", "CONFIRMED", "FAILED"],
  PAYMENT_PENDING: ["SUPPLIER_SUBMITTED", "CONFIRMED", "FAILED", "REFUNDED"],
  SUPPLIER_SUBMITTED: ["CONFIRMED", "FAILED", "REFUNDED"],
  CONFIRMED: ["REFUNDED", "FAILED"],
  FAILED: ["DRAFT"],
  REFUNDED: [],
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
  if (
    attempt.status !== "DRAFT" &&
    attempt.status !== "PAYMENT_PENDING" &&
    attempt.status !== "SUPPLIER_SUBMITTED"
  ) {
    return false;
  }
  const anchor = new Date(attempt.updated_at || attempt.started_at).getTime();
  if (!Number.isFinite(anchor)) return false;
  return now - anchor >= MARKETPLACE_STALE_AFTER_MS;
}
