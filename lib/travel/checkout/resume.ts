import "server-only";
import { createTravelCheckoutIntent } from "@/lib/travel/checkout/create-intent";
import {
  getCheckoutAttemptById,
  retireOpenDuplicateCheckoutAttempts,
  retireSupersededCheckoutAttempt,
  type TravelCheckoutAttempt,
} from "@/lib/travel/checkout/repository";
import { retrieveTravelPaymentIntent } from "@/lib/travel/checkout/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const RESUMABLE_PI_STATUSES = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
]);

async function ledgerTransactionIdForAttempt(attemptId: string) {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("travel_booking_transactions")
    .select("id")
    .eq("marketplace_attempt_id", attemptId)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

function itemizationFromAttempt(attempt: TravelCheckoutAttempt, paymentAmountCents?: number | null) {
  const snapshot = (attempt.offer_snapshot || {}) as Record<string, unknown>;
  const amountCents =
    Number.isFinite(Number(paymentAmountCents)) && Number(paymentAmountCents) > 0
      ? Math.round(Number(paymentAmountCents))
      : Number(attempt.total_amount_cents || 0);
  const taxAmountCents = Number(attempt.tax_amount_cents || 0);
  const serviceFeeCents = Math.max(
    0,
    Number(snapshot.serviceFeeCents) > 0
      ? Math.round(Number(snapshot.serviceFeeCents))
      : amountCents - Number(snapshot.fareCents || amountCents - taxAmountCents),
  );
  const fareCents = Math.max(0, amountCents - serviceFeeCents);
  return {
    amountCents,
    fareCents,
    taxAmountCents,
    serviceFeeCents,
    currency: String(attempt.currency || "USD").toUpperCase(),
    offerSnapshot: snapshot,
  };
}

/**
 * Resume an open marketplace checkout without browser sessionStorage.
 * - PAYMENT_PENDING with usable Stripe PI → reuse server PaymentIntent client_secret
 * - DRAFT / unusable PI → recreate via createTravelCheckoutIntent (live reprice),
 *   retire the prior attempt, and prune other open duplicates for the same offer
 */
export async function resumeTravelCheckoutAttempt(input: {
  userId: string;
  email: string;
  attemptId: string;
}) {
  const attemptId = String(input.attemptId || "").trim();
  if (!attemptId) {
    throw new Error("attemptId is required.");
  }

  const attempt = await getCheckoutAttemptById(attemptId);
  if (!attempt || attempt.user_id !== input.userId) {
    throw new Error("Checkout attempt not found.");
  }

  if (attempt.status === "CONFIRMED" || attempt.status === "SUPPLIER_SUBMITTED") {
    return {
      mode: "redirect" as const,
      attemptId: attempt.id,
      status: attempt.status,
      redirectTo: `/travel/confirmation?attemptId=${encodeURIComponent(attempt.id)}`,
    };
  }

  if (attempt.status === "FAILED" || attempt.status === "REFUNDED") {
    throw new Error("This checkout attempt is closed. Search again to start a new booking.");
  }

  if (attempt.status === "PAYMENT_PENDING" && attempt.payment_intent_id) {
    const paymentIntent = await retrieveTravelPaymentIntent(attempt.payment_intent_id);
    if (paymentIntent.status === "succeeded") {
      return {
        mode: "redirect" as const,
        attemptId: attempt.id,
        status: attempt.status,
        redirectTo: `/travel/confirmation?attemptId=${encodeURIComponent(attempt.id)}`,
      };
    }

    if (paymentIntent.client_secret && RESUMABLE_PI_STATUSES.has(paymentIntent.status)) {
      const money = itemizationFromAttempt(attempt, paymentIntent.amount);
      const transactionId = await ledgerTransactionIdForAttempt(attempt.id);
      await retireOpenDuplicateCheckoutAttempts({
        userId: input.userId,
        offerId: attempt.offer_id,
        exceptAttemptId: attempt.id,
        reason: `Superseded by resumed checkout attempt ${attempt.id}.`,
      });
      return {
        mode: "resume" as const,
        attemptId: attempt.id,
        transactionId,
        status: attempt.status,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amountCents: money.amountCents,
        fareCents: money.fareCents,
        taxAmountCents: money.taxAmountCents,
        serviceFeeCents: money.serviceFeeCents,
        currency: money.currency,
        provider: attempt.provider_key,
        kind: attempt.kind,
        offerId: attempt.offer_id,
        offerSnapshot: money.offerSnapshot,
        destinationLabel: attempt.destination_label,
        originLabel: attempt.origin_label,
        startAt: attempt.start_at,
        endAt: attempt.end_at,
      };
    }
  }

  // Recreate path: live reprice under server authority, then ledger hygiene.
  const snapshot = (attempt.offer_snapshot || {}) as Record<string, unknown>;
  const bookToken = String(snapshot.bookToken || "").trim();
  if (attempt.kind !== "flight" && !bookToken) {
    throw new Error(
      "This checkout attempt is missing a live bookToken in its server snapshot. Search again and restart checkout.",
    );
  }

  const result = await createTravelCheckoutIntent({
    userId: input.userId,
    email: input.email,
    kind: attempt.kind,
    offerId: attempt.offer_id,
    bookToken: bookToken || (attempt.kind === "flight" ? attempt.offer_id : null),
    provider: attempt.provider_key,
    checkIn: snapshot.checkIn ? String(snapshot.checkIn) : null,
    checkOut: snapshot.checkOut ? String(snapshot.checkOut) : null,
    pickupAt: snapshot.pickupAt ? String(snapshot.pickupAt) : attempt.start_at,
    dropoffAt: snapshot.dropoffAt ? String(snapshot.dropoffAt) : attempt.end_at,
    adults: Number(snapshot.adults) > 0 ? Number(snapshot.adults) : null,
    offer: snapshot,
    guest:
      snapshot.guest && typeof snapshot.guest === "object"
        ? (snapshot.guest as {
            givenName?: string;
            familyName?: string;
            phone?: string | null;
            bornOn?: string | null;
            gender?: "m" | "f" | null;
            title?: string | null;
          })
        : null,
  });

  const hygieneReason = `Superseded by resumed checkout attempt ${result.attemptId}.`;

  await retireSupersededCheckoutAttempt({
    attempt,
    userId: input.userId,
    reason: hygieneReason,
  });

  // Prune any other open duplicates for the same offer so owner queues stay clean.
  await retireOpenDuplicateCheckoutAttempts({
    userId: input.userId,
    offerId: attempt.offer_id,
    exceptAttemptId: result.attemptId,
    reason: hygieneReason,
  });

  const recreated = await getCheckoutAttemptById(result.attemptId);
  const offerSnapshot =
    (recreated?.offer_snapshot as Record<string, unknown> | undefined) || snapshot;

  return {
    mode: "recreated" as const,
    attemptId: result.attemptId,
    transactionId: result.transactionId,
    status: result.status,
    paymentIntentId: result.paymentIntentId,
    clientSecret: result.clientSecret,
    amountCents: result.amountCents,
    fareCents: result.fareCents,
    taxAmountCents: result.taxAmountCents,
    serviceFeeCents: result.serviceFeeCents,
    currency: result.currency,
    provider: result.provider,
    kind: result.kind,
    offerId: result.offerId,
    offerSnapshot,
    destinationLabel: attempt.destination_label,
    originLabel: attempt.origin_label,
    startAt: attempt.start_at,
    endAt: attempt.end_at,
    priorAttemptId: attempt.id,
  };
}
