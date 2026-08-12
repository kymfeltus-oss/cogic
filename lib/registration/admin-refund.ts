import "server-only";

import { createHash, randomUUID } from "node:crypto";
import Stripe from "stripe";

import { getStripeSecretKey } from "@/lib/checkout/server";
import { mapDatabaseError, RegistrationError } from "@/lib/registration/errors";
import { REGISTRATION_CHECKOUT_TYPE } from "@/lib/registration/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type RegistrationAdminRefundResult = {
  operationId: string;
  registrationId: string;
  paymentId: string;
  status: string;
  requestedAmountCents: number;
  currency: string;
  stripeRefundId: string | null;
  idempotent: boolean;
};

function requireReason(reason: string): string {
  const cleaned = reason.trim();
  if (cleaned.length < 8) {
    throw new RegistrationError(
      "validation",
      "A refund reason of at least 8 characters is required.",
    );
  }
  return cleaned.slice(0, 450);
}

function buildKeys(registrationId: string, paymentId: string, clientKey: string | null) {
  const operationKey = `registration-refund:${paymentId}`;
  const seed = clientKey?.trim() || `${operationKey}:${createHash("sha256").update(registrationId).digest("hex").slice(0, 12)}`;
  const idempotencyKey = seed.startsWith("registration-refund:")
    ? seed.slice(0, 200)
    : `registration-refund:${seed}`.slice(0, 200);
  return { operationKey, idempotencyKey };
}

/**
 * Owner refund saga: claim ledger row at DB amount → Stripe refund → complete ledger.
 * Never trusts client-supplied refund amounts.
 */
export async function executeRegistrationOwnerRefund(input: {
  registrationId: string;
  actorUserId: string;
  reason: string;
  idempotencyKey?: string | null;
}): Promise<RegistrationAdminRefundResult> {
  const registrationId = input.registrationId.trim();
  const actorUserId = input.actorUserId.trim();
  if (!registrationId || !actorUserId) {
    throw new RegistrationError("validation", "Registration and operator identity are required.");
  }

  const reason = requireReason(input.reason);
  const stripeSecretKey = getStripeSecretKey();
  if (!stripeSecretKey) {
    throw new RegistrationError("unavailable", "Payment processing is not configured.");
  }

  // Resolve payment id first so operation keys are stable across retries.
  const { data: paidPayment, error: paymentLookupError } = await getSupabaseAdmin()
    .from("registration_payments")
    .select("id,registration_id,status,amount_cents,currency,stripe_payment_intent_id")
    .eq("registration_id", registrationId)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentLookupError) {
    throw mapDatabaseError(paymentLookupError);
  }
  if (!paidPayment?.id) {
    throw new RegistrationError("not_found", "No paid registration payment was found to refund.");
  }

  const keys = buildKeys(registrationId, String(paidPayment.id), input.idempotencyKey ?? null);

  const { data: claimData, error: claimError } = await getSupabaseAdmin().rpc(
    "claim_registration_refund_operation",
    {
      p_actor_user_id: actorUserId,
      p_registration_id: registrationId,
      p_operation_key: keys.operationKey,
      p_idempotency_key: keys.idempotencyKey,
      p_operator_reason: reason,
    },
  );

  if (claimError) {
    throw mapDatabaseError(claimError);
  }

  const claim = (claimData ?? {}) as Record<string, unknown>;
  if (claim.ok !== true || !claim.operation_id || !claim.stripe_payment_intent_id) {
    throw new RegistrationError("unavailable", "Unable to claim registration refund operation.");
  }

  if (claim.status === "succeeded" && claim.idempotent === true) {
    return {
      operationId: String(claim.operation_id),
      registrationId: String(claim.registration_id),
      paymentId: String(claim.payment_id),
      status: "succeeded",
      requestedAmountCents: Number(claim.requested_amount_cents),
      currency: String(claim.currency ?? "usd"),
      stripeRefundId: claim.stripe_refund_id ? String(claim.stripe_refund_id) : null,
      idempotent: true,
    };
  }

  const amountCents = Number(claim.requested_amount_cents);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new RegistrationError("unavailable", "Refund claim did not return an authoritative amount.");
  }

  const stripe = new Stripe(stripeSecretKey);
  const paymentIntent = await stripe.paymentIntents.retrieve(String(claim.stripe_payment_intent_id));
  if (paymentIntent.status !== "succeeded" || paymentIntent.amount_received < amountCents) {
    throw new RegistrationError(
      "conflict",
      "Stripe does not show a captured payment matching the authoritative refund amount.",
    );
  }
  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: String(claim.stripe_payment_intent_id),
        amount: amountCents,
        reason: "requested_by_customer",
        metadata: {
          checkout_type: REGISTRATION_CHECKOUT_TYPE,
          registration_id: registrationId,
          payment_id: String(claim.payment_id),
          operation_id: String(claim.operation_id),
          owner_user_id: actorUserId,
          source: "owner_admin_refund",
        },
      },
      {
        idempotencyKey: keys.idempotencyKey,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe refund failed.";
    await getSupabaseAdmin().rpc("complete_registration_refund_operation", {
      p_actor_user_id: actorUserId,
      p_operation_id: String(claim.operation_id),
      p_outcome: "failed",
      p_stripe_refund_id: null,
      p_failure_code: "stripe_refund_failed",
      p_failure_message: message.slice(0, 400),
    });
    throw new RegistrationError("unavailable", "Stripe refund failed. The refund ledger recorded the failure.");
  }

  const { data: completeData, error: completeError } = await getSupabaseAdmin().rpc(
    "complete_registration_group_refund",
    {
      p_actor_user_id: actorUserId,
      p_operation_id: String(claim.operation_id),
      p_stripe_refund_id: refund.id,
    },
  );

  if (completeError) {
    throw mapDatabaseError(completeError);
  }

  const complete = (completeData ?? {}) as Record<string, unknown>;
  if (complete.ok !== true) {
    throw new RegistrationError("unavailable", "Refund succeeded in Stripe but ledger completion failed.");
  }

  return {
    operationId: String(complete.operation_id ?? claim.operation_id),
    registrationId: String(complete.registration_id ?? registrationId),
    paymentId: String(claim.payment_id),
    status: String(complete.status ?? "succeeded"),
    requestedAmountCents: amountCents,
    currency: String(claim.currency ?? "usd"),
    stripeRefundId: refund.id,
    idempotent: complete.idempotent === true,
  };
}

export function newRegistrationRefundClientKey(): string {
  return randomUUID();
}
