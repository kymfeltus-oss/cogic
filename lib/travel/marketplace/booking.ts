import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { TRAVEL_PROGRAM_KEY } from "@/lib/travel/types";
import {
  assertMarketplaceTransition,
  isStaleMarketplaceAttempt,
  MARKETPLACE_STALE_AFTER_MS,
  type MarketplaceAttemptStatus,
} from "./lifecycle";

export type MarketplaceKind = "hotel" | "flight" | "car";
export type { MarketplaceAttemptStatus };
export {
  assertMarketplaceTransition,
  isStaleMarketplaceAttempt,
  MARKETPLACE_STALE_AFTER_MS,
};

export type MarketplaceAttempt = {
  id: string;
  program_key: string;
  user_id: string;
  kind: MarketplaceKind;
  provider_key: string;
  offer_id: string;
  provider_offer_ref: string | null;
  offer_snapshot: Record<string, unknown>;
  quoted_amount_cents: number | null;
  currency: string;
  destination_label: string | null;
  origin_label: string | null;
  start_at: string | null;
  end_at: string | null;
  partner_booking_url: string | null;
  return_path: string;
  status: MarketplaceAttemptStatus;
  confirmation_number: string | null;
  payment_intent_id?: string | null;
  supplier_confirmation_number?: string | null;
  supplier_raw_response?: Record<string, unknown>;
  total_amount_cents?: number | null;
  tax_amount_cents?: number | null;
  itinerary_kind: MarketplaceKind | null;
  itinerary_record_id: string | null;
  hotel_reservation_id: string | null;
  failure_reason: string | null;
  started_at: string;
  redirected_at: string | null;
  returned_at: string | null;
  confirmed_at: string | null;
  canceled_at: string | null;
  updated_at: string;
};

export async function listUserMarketplaceAttempts(userId: string, statuses?: MarketplaceAttemptStatus[]) {
  const db = getSupabaseAdmin();
  let query = db
    .from("travel_marketplace_booking_attempts")
    .select("*")
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .eq("user_id", userId)
    .order("started_at", { ascending: false });
  if (statuses?.length) query = query.in("status", statuses);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as MarketplaceAttempt[];
}

export async function getMarketplaceAttemptForUser(attemptId: string, userId: string) {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("travel_marketplace_booking_attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("user_id", userId)
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MarketplaceAttempt | null) ?? null;
}

export async function cancelMarketplaceAttempt(input: {
  userId: string;
  attemptId: string;
  reason?: string;
}) {
  const existing = await getMarketplaceAttemptForUser(input.attemptId, input.userId);
  if (!existing) return null;
  assertMarketplaceTransition(existing.status, "FAILED");

  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("travel_marketplace_booking_attempts")
    .update({
      status: "FAILED",
      canceled_at: now,
      updated_at: now,
      failure_reason: input.reason?.slice(0, 500) || null,
    })
    .eq("id", input.attemptId)
    .eq("user_id", input.userId)
    .in("status", ["DRAFT", "PAYMENT_PENDING", "SUPPLIER_SUBMITTED"])
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as MarketplaceAttempt | null;
}

export async function listOwnerMarketplaceAttempts(filters: {
  q?: string;
  userId?: string;
  provider?: string;
  kind?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMinCents?: number | null;
  amountMaxCents?: number | null;
  staleOnly?: boolean;
  sort?: string;
}) {
  const db = getSupabaseAdmin();
  const sort = filters.sort || "started_at_desc";
  const ascending = sort.endsWith("_asc");
  const sortColumn =
    sort.startsWith("updated_at")
      ? "updated_at"
      : sort.startsWith("amount")
        ? "total_amount_cents"
        : "started_at";
  let query = db
    .from("travel_marketplace_booking_attempts")
    .select("*")
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .order(sortColumn, { ascending })
    .limit(200);
  if (filters.userId) query = query.eq("user_id", filters.userId);
  if (filters.provider) query = query.eq("provider_key", filters.provider);
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.dateFrom) query = query.gte("started_at", `${filters.dateFrom}T00:00:00.000Z`);
  if (filters.dateTo) query = query.lte("started_at", `${filters.dateTo}T23:59:59.999Z`);
  if (filters.amountMinCents != null && Number.isFinite(filters.amountMinCents)) {
    query = query.gte("total_amount_cents", Math.round(filters.amountMinCents));
  }
  if (filters.amountMaxCents != null && Number.isFinite(filters.amountMaxCents)) {
    query = query.lte("total_amount_cents", Math.round(filters.amountMaxCents));
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  let rows = (data ?? []) as MarketplaceAttempt[];
  if (filters.staleOnly) {
    const now = Date.now();
    rows = rows.filter((row) => isStaleMarketplaceAttempt(row, now));
  }
  const q = filters.q?.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    const hay = [
      row.id,
      row.user_id,
      row.kind,
      row.provider_key,
      row.status,
      row.destination_label,
      row.origin_label,
      row.confirmation_number,
      row.supplier_confirmation_number,
      row.payment_intent_id,
      row.offer_id,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function marketplaceExceptionQueues(attempts: MarketplaceAttempt[], now = Date.now()) {
  const open = attempts.filter(
    (a) =>
      a.status === "DRAFT" ||
      a.status === "PAYMENT_PENDING" ||
      a.status === "SUPPLIER_SUBMITTED",
  );
  return {
    booking_started_unconfirmed: attempts.filter((a) => a.status === "DRAFT"),
    pending_confirmation: attempts.filter((a) => a.status === "SUPPLIER_SUBMITTED"),
    missing_reference: attempts.filter(
      (a) => a.status === "SUPPLIER_SUBMITTED" && !a.confirmation_number,
    ),
    stale_pending_review: open.filter((a) => isStaleMarketplaceAttempt(a, now)),
    failed: attempts.filter((a) => a.status === "FAILED"),
    canceled: attempts.filter((a) => a.status === "FAILED"),
    confirmed: attempts.filter((a) => a.status === "CONFIRMED"),
    payment_pending: attempts.filter((a) => a.status === "PAYMENT_PENDING"),
    refunded: attempts.filter((a) => a.status === "REFUNDED"),
  };
}
