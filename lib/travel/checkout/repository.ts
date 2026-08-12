import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { TRAVEL_PROGRAM_KEY } from "@/lib/travel/types";
import {
  assertMarketplaceTransition,
  type MarketplaceAttemptStatus,
} from "@/lib/travel/marketplace/lifecycle";

export type TravelCheckoutAttempt = {
  id: string;
  program_key: string;
  user_id: string;
  kind: "hotel" | "flight" | "car";
  provider_key: string;
  offer_id: string;
  provider_offer_ref: string | null;
  offer_snapshot: Record<string, unknown>;
  quoted_amount_cents: number | null;
  total_amount_cents: number | null;
  tax_amount_cents: number | null;
  currency: string;
  destination_label: string | null;
  origin_label: string | null;
  start_at: string | null;
  end_at: string | null;
  partner_booking_url: string | null;
  return_path: string;
  status: MarketplaceAttemptStatus;
  payment_intent_id: string | null;
  supplier_confirmation_number: string | null;
  supplier_raw_response: Record<string, unknown>;
  confirmation_number: string | null;
  itinerary_kind: "hotel" | "flight" | "car" | null;
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

async function ensureTrip(userId: string) {
  const db = getSupabaseAdmin();
  let { data } = await db
    .from("user_trips")
    .select("*")
    .eq("user_id", userId)
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .maybeSingle();
  if (!data) {
    const created = await db
      .from("user_trips")
      .insert({ user_id: userId, program_key: TRAVEL_PROGRAM_KEY, status: "planning" })
      .select("*")
      .single();
    data = created.data;
  }
  return data;
}

export async function getCheckoutAttemptById(attemptId: string) {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("travel_marketplace_booking_attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TravelCheckoutAttempt | null) ?? null;
}

export async function getCheckoutAttemptByPaymentIntent(paymentIntentId: string) {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("travel_marketplace_booking_attempts")
    .select("*")
    .eq("payment_intent_id", paymentIntentId)
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TravelCheckoutAttempt | null) ?? null;
}

export async function insertDraftCheckoutAttempt(input: {
  userId: string;
  kind: "hotel" | "flight" | "car";
  provider: string;
  offerId: string;
  offerSnapshot: Record<string, unknown>;
  totalAmountCents: number;
  taxAmountCents: number;
  currency: string;
  destinationLabel: string | null;
  originLabel: string | null;
  startAt: string | null;
  endAt: string | null;
}) {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("travel_marketplace_booking_attempts")
    .insert({
      program_key: TRAVEL_PROGRAM_KEY,
      user_id: input.userId,
      kind: input.kind,
      provider_key: input.provider,
      offer_id: input.offerId,
      provider_offer_ref: input.offerId,
      offer_snapshot: input.offerSnapshot,
      quoted_amount_cents: input.totalAmountCents,
      total_amount_cents: input.totalAmountCents,
      tax_amount_cents: input.taxAmountCents,
      currency: input.currency,
      destination_label: input.destinationLabel,
      origin_label: input.originLabel,
      start_at: input.startAt,
      end_at: input.endAt,
      partner_booking_url: null,
      return_path: "/travel/trip",
      status: "DRAFT",
      supplier_raw_response: {},
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(error?.message || "Unable to create travel checkout attempt.");
  }
  return data as TravelCheckoutAttempt;
}

export async function upsertCheckoutLedger(input: {
  attempt: TravelCheckoutAttempt;
  status: MarketplaceAttemptStatus;
  taxProfileId?: string | null;
}) {
  const db = getSupabaseAdmin();
  const attempt = input.attempt;
  const taxProfileId =
    typeof input.taxProfileId === "string" && input.taxProfileId.trim()
      ? input.taxProfileId.trim()
      : null;
  const row = {
    program_key: TRAVEL_PROGRAM_KEY,
    user_id: attempt.user_id,
    lane: "marketplace",
    kind: attempt.kind,
    status: input.status,
    marketplace_attempt_id: attempt.id,
    hotel_reservation_id: attempt.hotel_reservation_id,
    itinerary_kind: attempt.itinerary_kind,
    itinerary_record_id: attempt.itinerary_record_id,
    provider_key: attempt.provider_key,
    offer_id: attempt.offer_id,
    payment_intent_id: attempt.payment_intent_id,
    supplier_confirmation_number: attempt.supplier_confirmation_number,
    supplier_raw_response: attempt.supplier_raw_response || {},
    total_amount_cents: attempt.total_amount_cents,
    tax_amount_cents: attempt.tax_amount_cents ?? 0,
    currency: attempt.currency,
    destination_label: attempt.destination_label,
    origin_label: attempt.origin_label,
    start_at: attempt.start_at,
    end_at: attempt.end_at,
    failure_reason: attempt.failure_reason,
    offer_snapshot: attempt.offer_snapshot || {},
    tax_profile_id: taxProfileId,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await db
    .from("travel_booking_transactions")
    .select("id,status")
    .eq("marketplace_attempt_id", attempt.id)
    .maybeSingle();

  if (!existing) {
    const { data, error } = await db
      .from("travel_booking_transactions")
      .insert({ ...row, started_at: attempt.started_at })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message || "Unable to create travel ledger row.");
    return data.id as string;
  }

  if (existing.status !== input.status) {
    assertMarketplaceTransition(
      existing.status as MarketplaceAttemptStatus,
      input.status,
    );
  }

  const { error } = await db
    .from("travel_booking_transactions")
    .update(row)
    .eq("id", existing.id);
  if (error) throw new Error(error.message);
  return existing.id as string;
}

export async function markAttemptPaymentPending(input: {
  attemptId: string;
  userId: string;
  paymentIntentId: string;
  transactionId: string;
}) {
  const db = getSupabaseAdmin();
  const existing = await getCheckoutAttemptById(input.attemptId);
  if (!existing || existing.user_id !== input.userId) {
    throw new Error("Checkout attempt not found.");
  }
  assertMarketplaceTransition(existing.status, "PAYMENT_PENDING");
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("travel_marketplace_booking_attempts")
    .update({
      status: "PAYMENT_PENDING",
      payment_intent_id: input.paymentIntentId,
      updated_at: now,
    })
    .eq("id", input.attemptId)
    .eq("user_id", input.userId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Unable to attach payment intent.");

  await db.from("travel_booking_transactions").update({
    status: "PAYMENT_PENDING",
    payment_intent_id: input.paymentIntentId,
    payment_pending_at: now,
    updated_at: now,
  }).eq("id", input.transactionId);

  await db.from("travel_booking_transaction_events").insert({
    transaction_id: input.transactionId,
    actor_user_id: input.userId,
    from_status: existing.status,
    to_status: "PAYMENT_PENDING",
    event_name: "payment_intent_created",
    details: { payment_intent_id: input.paymentIntentId },
  });

  return data as TravelCheckoutAttempt;
}

export async function captureConfirmedAttempt(input: {
  attempt: TravelCheckoutAttempt;
  confirmationNumber: string;
  supplierRaw: Record<string, unknown>;
  transactionId: string;
}) {
  const db = getSupabaseAdmin();
  const attempt = input.attempt;
  const confirmation = input.confirmationNumber.trim();
  if (confirmation.length < 3) {
    throw new Error("Supplier confirmation number is required.");
  }
  if (attempt.status === "CONFIRMED") return attempt;

  assertMarketplaceTransition(attempt.status, "SUPPLIER_SUBMITTED");
  const now = new Date().toISOString();

  await db
    .from("travel_marketplace_booking_attempts")
    .update({
      status: "SUPPLIER_SUBMITTED",
      supplier_raw_response: input.supplierRaw,
      updated_at: now,
    })
    .eq("id", attempt.id);

  await db.from("travel_booking_transactions").update({
    status: "SUPPLIER_SUBMITTED",
    supplier_raw_response: input.supplierRaw,
    supplier_submitted_at: now,
    updated_at: now,
  }).eq("id", input.transactionId);

  await db.from("travel_booking_transaction_events").insert({
    transaction_id: input.transactionId,
    actor_user_id: attempt.user_id,
    from_status: attempt.status,
    to_status: "SUPPLIER_SUBMITTED",
    event_name: "supplier_submitted",
    details: { provider: attempt.provider_key },
  });

  let hotel_reservation_id: string | null = null;
  let itinerary_kind: "hotel" | "flight" | "car" | null = null;
  let itinerary_record_id: string | null = null;
  const snap = attempt.offer_snapshot || {};

  if (attempt.kind === "hotel") {
    const hotelName = String(snap.name || attempt.destination_label || "Marketplace hotel");
    const roomType = String(snap.roomName || "Marketplace rate");
    const checkIn = String(snap.checkIn || attempt.start_at?.slice(0, 10) || "").slice(0, 10);
    const checkOut = String(snap.checkOut || attempt.end_at?.slice(0, 10) || "").slice(0, 10);
    const { count } = await db
      .from("travel_hotel_reservations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", attempt.user_id)
      .eq("program_key", TRAVEL_PROGRAM_KEY)
      .eq("reservation_status", "confirmed");
    const { data: reservation, error } = await db
      .from("travel_hotel_reservations")
      .insert({
        program_key: TRAVEL_PROGRAM_KEY,
        user_id: attempt.user_id,
        hotel_name_snapshot: hotelName,
        room_type: roomType,
        check_in: checkIn,
        check_out: checkOut,
        confirmation_number: confirmation,
        nightly_rate_cents: attempt.quoted_amount_cents,
        notes: `Marketplace provider: ${attempt.provider_key}`,
        booking_source: "marketplace",
        reservation_status: "confirmed",
        primary_stay: (count ?? 0) === 0,
        confirmed_at: now,
      })
      .select("id")
      .single();
    if (error || !reservation) throw new Error(error?.message || "Unable to save hotel reservation.");
    hotel_reservation_id = reservation.id;
    await db.from("travel_hotel_reservation_audit").insert({
      reservation_id: reservation.id,
      actor_user_id: attempt.user_id,
      action: "marketplace_supplier_confirmed",
      details: { attempt_id: attempt.id, provider: attempt.provider_key },
    });
  } else {
    const trip = await ensureTrip(attempt.user_id);
    if (!trip) throw new Error("Unable to open My Trip.");
    if (attempt.kind === "flight") {
      const { data, error } = await db
        .from("user_trip_flights")
        .insert({
          trip_id: trip.id,
          user_id: attempt.user_id,
          airline: String(snap.airline || attempt.provider_key),
          flight_number: String(snap.flightNumber || ""),
          origin: String(snap.origin || attempt.origin_label || ""),
          destination: String(snap.destination || attempt.destination_label || ""),
          departure_at: snap.departAt || attempt.start_at,
          arrival_at: snap.arriveAt || attempt.end_at,
          confirmation_number: confirmation,
          booked_externally: false,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message || "Unable to save flight.");
      itinerary_kind = "flight";
      itinerary_record_id = data.id;
    } else {
      const { data, error } = await db
        .from("user_trip_cars")
        .insert({
          trip_id: trip.id,
          user_id: attempt.user_id,
          company: String(snap.company || attempt.provider_key),
          confirmation_number: confirmation,
          pickup_at: snap.pickupAt || attempt.start_at,
          dropoff_at: snap.dropoffAt || attempt.end_at,
          booked_externally: false,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message || "Unable to save rental car.");
      itinerary_kind = "car";
      itinerary_record_id = data.id;
    }
    await db
      .from("user_trips")
      .update({ status: "trip_added", updated_at: now })
      .eq("id", trip.id)
      .eq("user_id", attempt.user_id);
  }

  assertMarketplaceTransition("SUPPLIER_SUBMITTED", "CONFIRMED");
  const { data: updated, error: updateError } = await db
    .from("travel_marketplace_booking_attempts")
    .update({
      status: "CONFIRMED",
      confirmation_number: confirmation,
      supplier_confirmation_number: confirmation,
      supplier_raw_response: input.supplierRaw,
      hotel_reservation_id,
      itinerary_kind,
      itinerary_record_id,
      confirmed_at: now,
      updated_at: now,
    })
    .eq("id", attempt.id)
    .select("*")
    .single();
  if (updateError || !updated) {
    throw new Error(updateError?.message || "Unable to confirm travel booking.");
  }

  await db.from("travel_booking_transactions").update({
    status: "CONFIRMED",
    supplier_confirmation_number: confirmation,
    supplier_raw_response: input.supplierRaw,
    hotel_reservation_id,
    itinerary_kind,
    itinerary_record_id,
    confirmed_at: now,
    updated_at: now,
  }).eq("id", input.transactionId);

  await db.from("travel_booking_transaction_events").insert({
    transaction_id: input.transactionId,
    actor_user_id: attempt.user_id,
    from_status: "SUPPLIER_SUBMITTED",
    to_status: "CONFIRMED",
    event_name: "supplier_confirmed",
    details: { supplier_confirmation_number: confirmation },
  });

  return updated as TravelCheckoutAttempt;
}

/**
 * Retire an open DRAFT / PAYMENT_PENDING attempt after a resume recreate.
 * Leaves CONFIRMED / SUPPLIER_SUBMITTED / REFUNDED untouched.
 */
export async function retireSupersededCheckoutAttempt(input: {
  attempt: TravelCheckoutAttempt;
  userId: string;
  reason: string;
}) {
  const attempt = input.attempt;
  if (attempt.user_id !== input.userId) {
    throw new Error("Checkout attempt not found.");
  }
  if (
    attempt.status === "CONFIRMED" ||
    attempt.status === "SUPPLIER_SUBMITTED" ||
    attempt.status === "REFUNDED" ||
    attempt.status === "FAILED"
  ) {
    return attempt;
  }

  assertMarketplaceTransition(attempt.status, "FAILED");
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  const reason = input.reason.slice(0, 500);

  const { data, error } = await db
    .from("travel_marketplace_booking_attempts")
    .update({
      status: "FAILED",
      failure_reason: reason,
      canceled_at: now,
      updated_at: now,
    })
    .eq("id", attempt.id)
    .eq("user_id", input.userId)
    .in("status", ["DRAFT", "PAYMENT_PENDING"])
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return attempt;

  const { data: ledger } = await db
    .from("travel_booking_transactions")
    .select("id,status")
    .eq("marketplace_attempt_id", attempt.id)
    .maybeSingle();

  if (ledger?.id) {
    if (ledger.status === "DRAFT" || ledger.status === "PAYMENT_PENDING") {
      await db
        .from("travel_booking_transactions")
        .update({
          status: "FAILED",
          failure_reason: reason,
          failed_at: now,
          updated_at: now,
        })
        .eq("id", ledger.id);

      await db.from("travel_booking_transaction_events").insert({
        transaction_id: ledger.id,
        actor_user_id: input.userId,
        from_status: ledger.status,
        to_status: "FAILED",
        event_name: "checkout_superseded_on_resume",
        details: { prior_attempt_id: attempt.id, reason },
      });
    }
  }

  return data as TravelCheckoutAttempt;
}

/**
 * Ledger hygiene: mark every other open DRAFT / PAYMENT_PENDING attempt for the same
 * user + offer as FAILED so owner queues are not flooded with stale resume siblings.
 * Never touches CONFIRMED / SUPPLIER_SUBMITTED / REFUNDED rows.
 */
export async function retireOpenDuplicateCheckoutAttempts(input: {
  userId: string;
  offerId: string;
  exceptAttemptId: string;
  reason: string;
}) {
  const offerId = String(input.offerId || "").trim();
  const exceptAttemptId = String(input.exceptAttemptId || "").trim();
  if (!offerId || !exceptAttemptId) return [] as TravelCheckoutAttempt[];

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("travel_marketplace_booking_attempts")
    .select("*")
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .eq("user_id", input.userId)
    .eq("offer_id", offerId)
    .in("status", ["DRAFT", "PAYMENT_PENDING"])
    .neq("id", exceptAttemptId)
    .limit(50);
  if (error) throw new Error(error.message);

  const retired: TravelCheckoutAttempt[] = [];
  for (const row of data ?? []) {
    const attempt = row as TravelCheckoutAttempt;
    const next = await retireSupersededCheckoutAttempt({
      attempt,
      userId: input.userId,
      reason: input.reason,
    });
    retired.push(next);
  }
  return retired;
}

export async function markAttemptSupplierFailed(input: {
  attempt: TravelCheckoutAttempt;
  transactionId: string;
  failureReason: string;
  refundId?: string | null;
}) {
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  const from = input.attempt.status;
  if (from === "CONFIRMED" || from === "REFUNDED") {
    return input.attempt;
  }

  const nextStatus: MarketplaceAttemptStatus = input.refundId ? "REFUNDED" : "FAILED";
  assertMarketplaceTransition(from, nextStatus);

  const { data, error } = await db
    .from("travel_marketplace_booking_attempts")
    .update({
      status: nextStatus,
      failure_reason: input.failureReason.slice(0, 500),
      supplier_raw_response: {
        ...(input.attempt.supplier_raw_response || {}),
        supplier_error: input.failureReason.slice(0, 500),
        ...(input.refundId ? { refund_id: input.refundId } : {}),
      },
      updated_at: now,
      canceled_at: now,
    })
    .eq("id", input.attempt.id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Unable to mark travel booking failed.");

  await db.from("travel_booking_transactions").update({
    status: nextStatus,
    failure_reason: input.failureReason.slice(0, 500),
    failed_at: nextStatus === "FAILED" ? now : null,
    refunded_at: nextStatus === "REFUNDED" ? now : null,
    updated_at: now,
  }).eq("id", input.transactionId);

  await db.from("travel_booking_transaction_events").insert({
    transaction_id: input.transactionId,
    actor_user_id: input.attempt.user_id,
    from_status: from,
    to_status: nextStatus,
    event_name: input.refundId ? "supplier_failed_refunded" : "supplier_failed",
    details: {
      reason: input.failureReason.slice(0, 500),
      refund_id: input.refundId || null,
    },
  });

  return data as TravelCheckoutAttempt;
}

export async function markAttemptSupplierSubmitted(input: {
  attemptId: string;
  userId: string;
  transactionId: string;
}) {
  const db = getSupabaseAdmin();
  const existing = await getCheckoutAttemptById(input.attemptId);
  if (!existing || existing.user_id !== input.userId) {
    throw new Error("Checkout attempt not found.");
  }
  if (existing.status === "SUPPLIER_SUBMITTED" || existing.status === "CONFIRMED") {
    return existing;
  }
  assertMarketplaceTransition(existing.status, "SUPPLIER_SUBMITTED");
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("travel_marketplace_booking_attempts")
    .update({ status: "SUPPLIER_SUBMITTED", updated_at: now })
    .eq("id", input.attemptId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Unable to mark supplier submitted.");

  await db.from("travel_booking_transactions").update({
    status: "SUPPLIER_SUBMITTED",
    supplier_submitted_at: now,
    updated_at: now,
  }).eq("id", input.transactionId);

  await db.from("travel_booking_transaction_events").insert({
    transaction_id: input.transactionId,
    actor_user_id: input.userId,
    from_status: existing.status,
    to_status: "SUPPLIER_SUBMITTED",
    event_name: "supplier_submit_started",
    details: {},
  });

  return data as TravelCheckoutAttempt;
}
