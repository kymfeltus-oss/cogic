import "server-only";
import {
  captureConfirmedAttempt,
  getCheckoutAttemptById,
  getCheckoutAttemptByPaymentIntent,
  markAttemptSupplierFailed,
  markAttemptSupplierSubmitted,
  upsertCheckoutLedger,
  type TravelCheckoutAttempt,
} from "@/lib/travel/checkout/repository";
import { refundTravelPaymentIntent, retrieveTravelPaymentIntent } from "@/lib/travel/checkout/stripe";
import { bookMarketplaceSupplier, type TravelCheckoutGuest } from "@/lib/travel/checkout/supplier";
import { getSupabaseAdmin } from "@/lib/supabase/server";

async function resolveTransactionId(attemptId: string) {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("travel_booking_transactions")
    .select("id")
    .eq("marketplace_attempt_id", attemptId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.id) return data.id as string;
  const attempt = await getCheckoutAttemptById(attemptId);
  if (!attempt) throw new Error("Checkout attempt not found.");
  return upsertCheckoutLedger({ attempt, status: attempt.status });
}

function guestFromAttempt(attempt: TravelCheckoutAttempt, fallbackEmail: string): TravelCheckoutGuest {
  const snap = attempt.offer_snapshot || {};
  const guest = (snap.guest && typeof snap.guest === "object" ? snap.guest : {}) as Record<
    string,
    unknown
  >;
  return {
    givenName: String(guest.givenName || snap.givenName || "Guest"),
    familyName: String(guest.familyName || snap.familyName || "Traveler"),
    email: String(guest.email || fallbackEmail || "").toLowerCase(),
    phone: guest.phone ? String(guest.phone) : null,
    bornOn: guest.bornOn ? String(guest.bornOn) : null,
    gender: guest.gender === "f" ? "f" : guest.gender === "m" ? "m" : null,
    title: guest.title ? String(guest.title) : null,
  };
}

/**
 * After Stripe reports a successful charge:
 * PAYMENT_PENDING → SUPPLIER_SUBMITTED → live supplier book → CONFIRMED.
 *
 * Absolute failure rollback: if the supplier rejects the room/seat after capture,
 * write FAILED/REFUNDED on the ledger and refund the PaymentIntent immediately.
 */
export async function fulfillPaidTravelCheckout(input: {
  paymentIntentId: string;
  userId?: string | null;
  email?: string | null;
  guestOverride?: TravelCheckoutGuest | null;
}) {
  const paymentIntent = await retrieveTravelPaymentIntent(input.paymentIntentId);
  if (paymentIntent.status !== "succeeded") {
    throw new Error(`PaymentIntent is not succeeded (status=${paymentIntent.status}).`);
  }

  const metadataUserId = paymentIntent.metadata?.user_id || null;
  if (input.userId && metadataUserId && input.userId !== metadataUserId) {
    throw new Error("Checkout identity mismatch.");
  }

  const attempt =
    (await getCheckoutAttemptByPaymentIntent(paymentIntent.id)) ||
    (paymentIntent.metadata?.attempt_id
      ? await getCheckoutAttemptById(paymentIntent.metadata.attempt_id)
      : null);

  if (!attempt) {
    throw new Error("No travel checkout attempt is bound to this PaymentIntent.");
  }
  if (metadataUserId && attempt.user_id !== metadataUserId) {
    throw new Error("Travel attempt user does not match PaymentIntent metadata.");
  }
  if (input.userId && attempt.user_id !== input.userId) {
    throw new Error("Travel attempt does not belong to this user.");
  }

  if (attempt.status === "CONFIRMED") {
    return {
      ok: true as const,
      idempotent: true,
      attemptId: attempt.id,
      status: attempt.status,
      confirmationNumber: attempt.supplier_confirmation_number || attempt.confirmation_number,
    };
  }
  if (attempt.status === "REFUNDED" || attempt.status === "FAILED") {
    return {
      ok: false as const,
      idempotent: true,
      attemptId: attempt.id,
      status: attempt.status,
      error: attempt.failure_reason || "Travel checkout already failed.",
      refundId:
        typeof attempt.supplier_raw_response?.refund_id === "string"
          ? attempt.supplier_raw_response.refund_id
          : null,
    };
  }

  const expectedAmount = Number(attempt.total_amount_cents || 0);
  if (!expectedAmount || paymentIntent.amount !== expectedAmount) {
    throw new Error("PaymentIntent amount does not match the travel attempt total.");
  }

  const transactionId = await resolveTransactionId(attempt.id);
  const email =
    input.email ||
    paymentIntent.receipt_email ||
    paymentIntent.metadata?.email ||
    "";
  const guest = input.guestOverride || guestFromAttempt(attempt, email);

  let submitted = attempt;
  try {
    submitted = await markAttemptSupplierSubmitted({
      attemptId: attempt.id,
      userId: attempt.user_id,
      transactionId,
    });
  } catch (error) {
    if (attempt.status !== "SUPPLIER_SUBMITTED") {
      throw error;
    }
  }

  try {
    const fareOnly = Number(
      (attempt.offer_snapshot as { fareCents?: number }).fareCents ||
        attempt.quoted_amount_cents ||
        expectedAmount,
    );
    const booked = await bookMarketplaceSupplier({
      kind: attempt.kind,
      provider: attempt.provider_key,
      offerSnapshot: {
        ...attempt.offer_snapshot,
        fareCents: fareOnly,
      },
      attemptId: attempt.id,
      totalAmountCents: fareOnly,
      currency: attempt.currency,
      guest,
    });

    const confirmationNumber = String(booked.confirmationNumber || "").trim();
    if (confirmationNumber.length < 3) {
      throw new Error("Supplier booking returned without a usable confirmation string.");
    }

    const confirmed = await captureConfirmedAttempt({
      attempt: { ...submitted, status: "SUPPLIER_SUBMITTED" },
      confirmationNumber,
      supplierRaw: booked.raw,
      transactionId,
    });

    return {
      ok: true as const,
      idempotent: false,
      attemptId: confirmed.id,
      status: confirmed.status,
      confirmationNumber: confirmed.supplier_confirmation_number,
    };
  } catch (supplierError) {
    const reason =
      supplierError instanceof Error
        ? supplierError.message
        : "Supplier reservation failed after payment.";

    let refundId: string | null = null;
    try {
      const refund = await refundTravelPaymentIntent({
        paymentIntentId: paymentIntent.id,
        reason,
        attemptId: attempt.id,
      });
      refundId = refund.id;
    } catch (refundError) {
      const refundMessage =
        refundError instanceof Error ? refundError.message : "Stripe refund failed.";
      await markAttemptSupplierFailed({
        attempt: { ...submitted, status: "SUPPLIER_SUBMITTED" },
        transactionId,
        failureReason: `${reason} Refund failed: ${refundMessage}`,
        refundId: null,
      });
      throw new Error(
        `Supplier booking failed and automatic refund failed. ${reason} ${refundMessage}`,
      );
    }

    const failed = await markAttemptSupplierFailed({
      attempt: { ...submitted, status: "SUPPLIER_SUBMITTED" },
      transactionId,
      failureReason: reason,
      refundId,
    });

    return {
      ok: false as const,
      idempotent: false,
      attemptId: failed.id,
      status: failed.status,
      error: reason,
      refundId,
    };
  }
}
