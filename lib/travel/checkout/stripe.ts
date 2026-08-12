import "server-only";
import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/checkout/server";

export function getTravelStripeClient(): Stripe {
  const key = getStripeSecretKey();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  return new Stripe(key);
}

export async function createTravelPaymentIntent(input: {
  amountCents: number;
  currency: string;
  customerEmail: string;
  userId: string;
  attemptId: string;
  transactionId: string;
  kind: "hotel" | "flight" | "car";
  provider: string;
  description: string;
  taxProfileId?: string | null;
  taxExemptionApplied?: boolean;
}) {
  if (!Number.isInteger(input.amountCents) || input.amountCents < 50) {
    throw new Error("Travel payment amount must be at least $0.50.");
  }

  const stripe = getTravelStripeClient();
  const metadata: Record<string, string> = {
    checkout_type: "travel_marketplace",
    user_id: input.userId,
    email: input.customerEmail,
    attempt_id: input.attemptId,
    transaction_id: input.transactionId,
    kind: input.kind,
    provider: input.provider,
    amount_cents: String(input.amountCents),
    tax_exemption_applied: input.taxExemptionApplied ? "true" : "false",
  };
  if (input.taxExemptionApplied && input.taxProfileId) {
    metadata.tax_profile_id = input.taxProfileId;
  }

  return stripe.paymentIntents.create(
    {
      amount: input.amountCents,
      currency: input.currency.toLowerCase(),
      receipt_email: input.customerEmail,
      description: input.description.slice(0, 900),
      automatic_payment_methods: { enabled: true },
      metadata,
    },
    {
      idempotencyKey: `travel-pi-${input.attemptId}`,
    },
  );
}

export async function retrieveTravelPaymentIntent(paymentIntentId: string) {
  const stripe = getTravelStripeClient();
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

export async function refundTravelPaymentIntent(input: {
  paymentIntentId: string;
  reason: string;
  attemptId: string;
}) {
  const stripe = getTravelStripeClient();
  return stripe.refunds.create(
    {
      payment_intent: input.paymentIntentId,
      reason: "requested_by_customer",
      metadata: {
        checkout_type: "travel_marketplace",
        attempt_id: input.attemptId,
        failure_reason: input.reason.slice(0, 450),
      },
    },
    {
      idempotencyKey: `travel-refund-${input.attemptId}`,
    },
  );
}
