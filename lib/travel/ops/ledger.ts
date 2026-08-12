import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { TRAVEL_PROGRAM_KEY } from "@/lib/travel/types";

export type OwnerBookingTransactionRow = {
  id: string;
  user_id: string;
  lane: string;
  kind: string;
  status: string;
  provider_key: string | null;
  marketplace_attempt_id: string | null;
  offer_id: string | null;
  payment_intent_id: string | null;
  supplier_confirmation_number: string | null;
  total_amount_cents: number | null;
  tax_amount_cents: number | null;
  currency: string;
  destination_label: string | null;
  origin_label: string | null;
  start_at: string | null;
  end_at: string | null;
  failure_reason: string | null;
  started_at: string;
  updated_at: string;
  confirmed_at: string | null;
  refunded_at: string | null;
};

export async function listOwnerBookingTransactions(filters: {
  q?: string;
  userId?: string;
  provider?: string;
  kind?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMinCents?: number | null;
  amountMaxCents?: number | null;
  sort?: string;
}): Promise<OwnerBookingTransactionRow[]> {
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
    .from("travel_booking_transactions")
    .select(
      "id,user_id,lane,kind,status,provider_key,marketplace_attempt_id,offer_id,payment_intent_id,supplier_confirmation_number,total_amount_cents,tax_amount_cents,currency,destination_label,origin_label,start_at,end_at,failure_reason,started_at,updated_at,confirmed_at,refunded_at",
    )
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
  const rows = (data ?? []) as OwnerBookingTransactionRow[];

  const q = filters.q?.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    const hay = [
      row.id,
      row.user_id,
      row.lane,
      row.kind,
      row.status,
      row.provider_key,
      row.marketplace_attempt_id,
      row.offer_id,
      row.payment_intent_id,
      row.supplier_confirmation_number,
      row.destination_label,
      row.origin_label,
      row.failure_reason,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export async function listRecentTransactionEvents(transactionIds: string[], limit = 40) {
  if (!transactionIds.length) return [];
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("travel_booking_transaction_events")
    .select("id,transaction_id,actor_user_id,from_status,to_status,event_name,details,created_at")
    .in("transaction_id", transactionIds.slice(0, 80))
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function logOwnerTransactionOverride(input: {
  actorUserId: string;
  attemptId?: string | null;
  transactionId?: string | null;
  note: string;
  eventName?: string | null;
}) {
  const note = String(input.note || "").trim().slice(0, 2000);
  if (note.length < 3) throw new Error("Override note must be at least 3 characters.");

  const db = getSupabaseAdmin();
  let transactionId = input.transactionId?.trim() || "";
  let attemptId = input.attemptId?.trim() || "";
  let status = "DRAFT";
  let userId: string | null = null;

  if (!transactionId && attemptId) {
    const { data: txn } = await db
      .from("travel_booking_transactions")
      .select("id,status,user_id")
      .eq("marketplace_attempt_id", attemptId)
      .eq("program_key", TRAVEL_PROGRAM_KEY)
      .maybeSingle();
    if (txn?.id) {
      transactionId = String(txn.id);
      status = String(txn.status);
      userId = txn.user_id ? String(txn.user_id) : null;
    }
  }

  if (!transactionId) {
    throw new Error("Provide a transactionId or attemptId linked to a travel_booking_transactions row.");
  }

  const { data: txn } = await db
    .from("travel_booking_transactions")
    .select("id,status,user_id,marketplace_attempt_id,supplier_raw_response")
    .eq("id", transactionId)
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .maybeSingle();
  if (!txn?.id) throw new Error("Transaction not found.");

  status = String(txn.status);
  userId = txn.user_id ? String(txn.user_id) : userId;
  attemptId = attemptId || (txn.marketplace_attempt_id ? String(txn.marketplace_attempt_id) : "");

  const now = new Date().toISOString();
  const eventName = String(input.eventName || "owner_internal_override").trim().slice(0, 80);

  const { data: event, error: eventError } = await db
    .from("travel_booking_transaction_events")
    .insert({
      transaction_id: transactionId,
      actor_user_id: input.actorUserId,
      from_status: status,
      to_status: status,
      event_name: eventName,
      details: {
        note,
        source: "owner_ops_ledger",
        attempt_id: attemptId || null,
      },
    })
    .select("id,created_at")
    .single();
  if (eventError || !event) {
    throw new Error(eventError?.message || "Unable to write override event.");
  }

  const prior = (txn.supplier_raw_response && typeof txn.supplier_raw_response === "object"
    ? txn.supplier_raw_response
    : {}) as Record<string, unknown>;
  const overrides = Array.isArray(prior.owner_overrides) ? [...prior.owner_overrides] : [];
  overrides.unshift({
    at: now,
    actor_user_id: input.actorUserId,
    note,
    event_name: eventName,
    event_id: event.id,
  });

  await db
    .from("travel_booking_transactions")
    .update({
      supplier_raw_response: { ...prior, owner_overrides: overrides.slice(0, 40) },
      updated_at: now,
    })
    .eq("id", transactionId);

  if (attemptId) {
    const { data: attempt } = await db
      .from("travel_marketplace_booking_attempts")
      .select("id,supplier_raw_response")
      .eq("id", attemptId)
      .eq("program_key", TRAVEL_PROGRAM_KEY)
      .maybeSingle();
    if (attempt?.id) {
      const attemptPrior = (attempt.supplier_raw_response && typeof attempt.supplier_raw_response === "object"
        ? attempt.supplier_raw_response
        : {}) as Record<string, unknown>;
      const attemptOverrides = Array.isArray(attemptPrior.owner_overrides)
        ? [...attemptPrior.owner_overrides]
        : [];
      attemptOverrides.unshift({
        at: now,
        actor_user_id: input.actorUserId,
        note,
        event_name: eventName,
        event_id: event.id,
      });
      await db
        .from("travel_marketplace_booking_attempts")
        .update({
          supplier_raw_response: {
            ...attemptPrior,
            owner_overrides: attemptOverrides.slice(0, 40),
          },
          updated_at: now,
        })
        .eq("id", attemptId);
    }
  }

  return {
    eventId: event.id,
    transactionId,
    attemptId: attemptId || null,
    userId,
    status,
  };
}
