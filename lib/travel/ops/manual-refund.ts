import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getCheckoutAttemptById } from "@/lib/travel/checkout/repository";
import { getTravelStripeClient } from "@/lib/travel/checkout/stripe";
import { assertMarketplaceTransition } from "@/lib/travel/marketplace/lifecycle";
import { TRAVEL_PROGRAM_KEY } from "@/lib/travel/types";

export async function ownerRefundMarketplaceAttempt(input: {
  attemptId: string;
  actorUserId: string;
  reason: string;
}) {
  const reason = String(input.reason || "").trim().slice(0, 450);
  if (reason.length < 3) throw new Error("Refund reason is required.");

  const attempt = await getCheckoutAttemptById(input.attemptId);
  if (!attempt) throw new Error("Marketplace attempt not found.");
  if (attempt.status === "REFUNDED") {
    return { attemptId: attempt.id, status: "REFUNDED" as const, refundId: null, alreadyRefunded: true };
  }
  if (!attempt.payment_intent_id) {
    throw new Error("Attempt has no Stripe payment_intent_id to reverse.");
  }

  assertMarketplaceTransition(attempt.status, "REFUNDED");

  const stripe = getTravelStripeClient();
  const refund = await stripe.refunds.create(
    {
      payment_intent: attempt.payment_intent_id,
      reason: "requested_by_customer",
      metadata: {
        checkout_type: "travel_marketplace",
        attempt_id: attempt.id,
        owner_user_id: input.actorUserId,
        failure_reason: reason,
        source: "owner_manual_refund",
      },
    },
    {
      idempotencyKey: `travel-owner-refund-${attempt.id}`,
    },
  );

  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  const from = attempt.status;

  const { data, error } = await db
    .from("travel_marketplace_booking_attempts")
    .update({
      status: "REFUNDED",
      failure_reason: reason,
      supplier_raw_response: {
        ...(attempt.supplier_raw_response || {}),
        owner_refund_id: refund.id,
        owner_refund_at: now,
        owner_refund_reason: reason,
      },
      canceled_at: now,
      updated_at: now,
    })
    .eq("id", attempt.id)
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .select("id,status")
    .single();
  if (error || !data) throw new Error(error?.message || "Unable to mark attempt refunded.");

  const { data: txn } = await db
    .from("travel_booking_transactions")
    .select("id")
    .eq("marketplace_attempt_id", attempt.id)
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .maybeSingle();

  if (txn?.id) {
    const ledgerUpdate = await db
      .from("travel_booking_transactions")
      .update({
        status: "REFUNDED",
        failure_reason: reason,
        refunded_at: now,
        updated_at: now,
      })
      .eq("id", txn.id);
    if (!ledgerUpdate.error) {
      await db.from("travel_booking_transaction_events").insert({
        transaction_id: txn.id,
        actor_user_id: input.actorUserId,
        from_status: from,
        to_status: "REFUNDED",
        event_name: "owner_manual_stripe_refund",
        details: { refund_id: refund.id, reason },
      });
    }
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

  return {
    attemptId: attempt.id,
    status: "REFUNDED" as const,
    refundId: refund.id,
    alreadyRefunded: false,
  };
}
