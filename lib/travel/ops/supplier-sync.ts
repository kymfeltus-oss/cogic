import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getCheckoutAttemptById } from "@/lib/travel/checkout/repository";
import { assertMarketplaceTransition } from "@/lib/travel/marketplace/lifecycle";
import { retrieveExpediaItinerary } from "@/lib/travel/marketplace/expedia-rapid";
import { retrieveDuffelOrder } from "@/lib/travel/marketplace/duffel";
import { TRAVEL_PROGRAM_KEY } from "@/lib/travel/types";
import { recordSupplierChangeEvent } from "@/lib/travel/ops/supplier-events";

async function ledgerForAttempt(attemptId: string) {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("travel_booking_transactions")
    .select("id")
    .eq("marketplace_attempt_id", attemptId)
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

export async function syncMarketplaceAttemptSupplierStatus(input: {
  attemptId: string;
  actorUserId: string;
  attendeeEmail?: string | null;
}) {
  const attempt = await getCheckoutAttemptById(input.attemptId);
  if (!attempt) throw new Error("Marketplace attempt not found.");

  const confirmation =
    attempt.supplier_confirmation_number ||
    attempt.confirmation_number ||
    String(attempt.supplier_raw_response?.orderId || attempt.supplier_raw_response?.itinerary_id || "");
  if (!confirmation || confirmation.length < 3) {
    throw new Error("Attempt has no supplier confirmation to query.");
  }

  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  let supplierStatus: string | null = null;
  let canceled = false;
  let raw: Record<string, unknown> = {};
  let departureAt: string | null = null;
  let arrivalAt: string | null = null;
  let roomName: string | null = null;
  let checkIn: string | null = null;
  let checkOut: string | null = null;

  if (attempt.provider_key === "expedia-rapid") {
    const live = await retrieveExpediaItinerary({
      itineraryId: confirmation,
      email: input.attendeeEmail,
    });
    supplierStatus = live.status;
    canceled = live.canceled;
    raw = live.raw;
    roomName = live.roomName;
    checkIn = live.checkIn;
    checkOut = live.checkOut;
  } else if (attempt.provider_key === "duffel") {
    const live = await retrieveDuffelOrder(confirmation);
    canceled = live.canceled;
    supplierStatus = canceled ? "canceled" : "confirmed";
    raw = live.raw;
    departureAt = live.departureAt;
    arrivalAt = live.arrivalAt;
  } else {
    throw new Error(`Live supplier sync is not implemented for ${attempt.provider_key}.`);
  }

  await db
    .from("travel_marketplace_booking_attempts")
    .update({
      supplier_raw_response: {
        ...(attempt.supplier_raw_response || {}),
        last_sync_at: now,
        last_sync_status: supplierStatus,
        last_sync: raw,
      },
      start_at: departureAt || checkIn || attempt.start_at,
      end_at: arrivalAt || checkOut || attempt.end_at,
      updated_at: now,
    })
    .eq("id", attempt.id)
    .eq("program_key", TRAVEL_PROGRAM_KEY);

  const transactionId = await ledgerForAttempt(attempt.id);

  if (canceled && attempt.status === "CONFIRMED") {
    assertMarketplaceTransition("CONFIRMED", "FAILED");
    await db
      .from("travel_marketplace_booking_attempts")
      .update({
        status: "FAILED",
        failure_reason: "Supplier reported cancellation on live status sync.",
        canceled_at: now,
        updated_at: now,
      })
      .eq("id", attempt.id);

    if (transactionId) {
      await db
        .from("travel_booking_transactions")
        .update({
          status: "FAILED",
          failure_reason: "Supplier reported cancellation on live status sync.",
          failed_at: now,
          updated_at: now,
        })
        .eq("id", transactionId);
      await db.from("travel_booking_transaction_events").insert({
        transaction_id: transactionId,
        actor_user_id: input.actorUserId,
        from_status: "CONFIRMED",
        to_status: "FAILED",
        event_name: "owner_supplier_sync_canceled",
        details: { supplier_status: supplierStatus },
      });
    }

    if (attempt.hotel_reservation_id) {
      await db
        .from("travel_hotel_reservations")
        .update({
          reservation_status: "canceled",
          primary_stay: false,
          canceled_at: now,
          updated_at: now,
        })
        .eq("id", attempt.hotel_reservation_id)
        .eq("program_key", TRAVEL_PROGRAM_KEY);
    }
  }

  if (attempt.kind === "flight" && (departureAt || arrivalAt) && attempt.itinerary_record_id) {
    const patch: Record<string, unknown> = { updated_at: now };
    if (departureAt) patch.departure_at = departureAt;
    if (arrivalAt) patch.arrival_at = arrivalAt;
    await db.from("user_trip_flights").update(patch).eq("id", attempt.itinerary_record_id).eq("user_id", attempt.user_id);
  }

  if (attempt.kind === "hotel" && roomName && attempt.hotel_reservation_id) {
    await db
      .from("travel_hotel_reservations")
      .update({ room_type: roomName, updated_at: now })
      .eq("id", attempt.hotel_reservation_id)
      .eq("program_key", TRAVEL_PROGRAM_KEY);
  }

  await recordSupplierChangeEvent({
    providerKey: attempt.provider_key,
    eventType: canceled ? "cancellation" : "status_update",
    providerEventId: `sync:${attempt.id}:${now}`,
    marketplaceAttemptId: attempt.id,
    transactionId,
    userId: attempt.user_id,
    summary: canceled
      ? "Supplier live sync reported a cancellation."
      : `Supplier live sync OK${supplierStatus ? ` (${supplierStatus})` : ""}.`,
    payload: { supplierStatus, canceled, roomName, checkIn, checkOut, departureAt, arrivalAt },
    applied: true,
  });

  return {
    attemptId: attempt.id,
    supplierStatus,
    canceled,
    confirmation,
  };
}
