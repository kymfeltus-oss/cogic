import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { assertMarketplaceTransition } from "@/lib/travel/marketplace/lifecycle";
import { TRAVEL_PROGRAM_KEY } from "@/lib/travel/types";
import { recordSupplierChangeEvent } from "@/lib/travel/ops/supplier-events";
import type { NormalizedSupplierWebhook } from "@/lib/travel/ops/supplier-webhook-parse";

export {
  normalizeSupplierWebhookPayload,
  verifySupplierWebhookSignature,
  type NormalizedSupplierWebhook,
} from "@/lib/travel/ops/supplier-webhook-parse";

async function findAttemptBySupplierRef(refs: string[]) {
  const db = getSupabaseAdmin();
  for (const ref of refs.filter(Boolean)) {
    const bySupplier = await db
      .from("travel_marketplace_booking_attempts")
      .select("*")
      .eq("program_key", TRAVEL_PROGRAM_KEY)
      .eq("supplier_confirmation_number", ref)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (bySupplier.data) return bySupplier.data;

    const byLegacy = await db
      .from("travel_marketplace_booking_attempts")
      .select("*")
      .eq("program_key", TRAVEL_PROGRAM_KEY)
      .eq("confirmation_number", ref)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byLegacy.data) return byLegacy.data;
  }
  return null;
}

async function resolveAttempt(normalized: NormalizedSupplierWebhook) {
  const db = getSupabaseAdmin();

  if (normalized.marketplaceAttemptId) {
    const { data } = await db
      .from("travel_marketplace_booking_attempts")
      .select("*")
      .eq("program_key", TRAVEL_PROGRAM_KEY)
      .eq("id", normalized.marketplaceAttemptId)
      .maybeSingle();
    if (data) return data;
  }

  if (normalized.transactionId) {
    const { data: txn } = await db
      .from("travel_booking_transactions")
      .select("marketplace_attempt_id")
      .eq("program_key", TRAVEL_PROGRAM_KEY)
      .eq("id", normalized.transactionId)
      .maybeSingle();
    if (txn?.marketplace_attempt_id) {
      const { data } = await db
        .from("travel_marketplace_booking_attempts")
        .select("*")
        .eq("program_key", TRAVEL_PROGRAM_KEY)
        .eq("id", txn.marketplace_attempt_id)
        .maybeSingle();
      if (data) return data;
    }
  }

  const refs = [normalized.confirmationNumber, normalized.orderId].filter(Boolean) as string[];
  return findAttemptBySupplierRef(refs);
}

export async function applySupplierWebhookEvent(normalized: NormalizedSupplierWebhook) {
  const attempt = await resolveAttempt(normalized);
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();

  let transactionId: string | null = normalized.transactionId || null;
  let applied = false;

  if (attempt) {
    if (!transactionId) {
      const { data: txn } = await db
        .from("travel_booking_transactions")
        .select("id")
        .eq("marketplace_attempt_id", attempt.id)
        .maybeSingle();
      transactionId = txn?.id ? String(txn.id) : null;
    }

    const patch: Record<string, unknown> = {
      supplier_raw_response: {
        ...(attempt.supplier_raw_response || {}),
        last_webhook_at: now,
        last_webhook: normalized.raw,
      },
      updated_at: now,
    };
    if (normalized.changes.departureAt || normalized.changes.checkIn) {
      patch.start_at = normalized.changes.departureAt || normalized.changes.checkIn;
    }
    if (normalized.changes.arrivalAt || normalized.changes.checkOut) {
      patch.end_at = normalized.changes.arrivalAt || normalized.changes.checkOut;
    }

    let toStatus = attempt.status;
    if (normalized.changes.canceled && attempt.status === "CONFIRMED") {
      assertMarketplaceTransition("CONFIRMED", "FAILED");
      patch.status = "FAILED";
      patch.failure_reason = "Supplier webhook reported cancellation.";
      patch.canceled_at = now;
      toStatus = "FAILED";
      if (transactionId) {
        await db
          .from("travel_booking_transactions")
          .update({
            status: "FAILED",
            failure_reason: "Supplier webhook reported cancellation.",
            failed_at: now,
            updated_at: now,
          })
          .eq("id", transactionId);
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

    await db
      .from("travel_marketplace_booking_attempts")
      .update(patch)
      .eq("id", attempt.id)
      .eq("program_key", TRAVEL_PROGRAM_KEY);

    if (transactionId) {
      const { data: existingTxn } = await db
        .from("travel_booking_transactions")
        .select("supplier_raw_response")
        .eq("id", transactionId)
        .maybeSingle();
      const priorTxnRaw =
        existingTxn?.supplier_raw_response && typeof existingTxn.supplier_raw_response === "object"
          ? (existingTxn.supplier_raw_response as Record<string, unknown>)
          : {};
      const txnPatch: Record<string, unknown> = {
        supplier_raw_response: {
          ...priorTxnRaw,
          last_webhook_at: now,
          last_webhook: normalized.raw,
        },
        updated_at: now,
      };
      if (patch.start_at) txnPatch.start_at = patch.start_at;
      if (patch.end_at) txnPatch.end_at = patch.end_at;
      await db.from("travel_booking_transactions").update(txnPatch).eq("id", transactionId);

      await db.from("travel_booking_transaction_events").insert({
        transaction_id: transactionId,
        actor_user_id: null,
        from_status: attempt.status,
        to_status: toStatus,
        event_name:
          toStatus !== attempt.status
            ? "supplier_webhook_cancellation"
            : `supplier_webhook_${normalized.eventType}`,
        details: {
          provider: normalized.providerKey,
          event_type: normalized.eventType,
          changes: normalized.changes,
          summary: normalized.summary,
        },
      });
    }

    if (
      attempt.kind === "flight" &&
      attempt.itinerary_record_id &&
      (normalized.changes.departureAt || normalized.changes.arrivalAt)
    ) {
      const flightPatch: Record<string, unknown> = { updated_at: now };
      if (normalized.changes.departureAt) flightPatch.departure_at = normalized.changes.departureAt;
      if (normalized.changes.arrivalAt) flightPatch.arrival_at = normalized.changes.arrivalAt;
      await db
        .from("user_trip_flights")
        .update(flightPatch)
        .eq("id", attempt.itinerary_record_id)
        .eq("user_id", attempt.user_id);
    }

    if (attempt.hotel_reservation_id && normalized.changes.roomName) {
      await db
        .from("travel_hotel_reservations")
        .update({ room_type: normalized.changes.roomName, updated_at: now })
        .eq("id", attempt.hotel_reservation_id)
        .eq("program_key", TRAVEL_PROGRAM_KEY);
    }

    if (
      attempt.hotel_reservation_id &&
      (normalized.changes.checkIn || normalized.changes.checkOut)
    ) {
      const stayPatch: Record<string, unknown> = { updated_at: now };
      if (normalized.changes.checkIn) stayPatch.check_in = String(normalized.changes.checkIn).slice(0, 10);
      if (normalized.changes.checkOut) stayPatch.check_out = String(normalized.changes.checkOut).slice(0, 10);
      await db
        .from("travel_hotel_reservations")
        .update(stayPatch)
        .eq("id", attempt.hotel_reservation_id)
        .eq("program_key", TRAVEL_PROGRAM_KEY);
    }

    applied = true;
  }

  const event = await recordSupplierChangeEvent({
    providerKey: normalized.providerKey,
    eventType: normalized.eventType,
    providerEventId: normalized.providerEventId,
    marketplaceAttemptId: attempt?.id || null,
    transactionId,
    userId: attempt?.user_id || null,
    summary: attempt
      ? normalized.summary
      : `${normalized.summary} (no matching booking attempt yet)`,
    payload: normalized.raw,
    applied,
  });

  return {
    applied,
    attemptId: attempt?.id || null,
    userId: attempt?.user_id || null,
    eventId: event?.id || null,
  };
}
