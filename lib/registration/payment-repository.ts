import "server-only";

import { mapDatabaseError, RegistrationError } from "@/lib/registration/errors";
import { getRegistrationPricingConfig } from "@/lib/registration/pricing";
import {
  DEFAULT_PROGRAM_KEY,
  mapRegistrationPaymentRow,
  mapRegistrationRow,
  REGISTRATION_CHECKOUT_TYPE,
  type Registration,
  type RegistrationPayment,
  type RegistrationPaymentRow,
  type RegistrationRow,
} from "@/lib/registration/types";
import { writeRegistrationAuditEvent } from "@/lib/registration/audit";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const CHECKOUT_ELIGIBLE_STATUSES = ["submitted", "payment_pending"] as const;

export type BeginRegistrationCheckoutInput = {
  userId: string;
  stripeSessionId: string;
};

export type BeginRegistrationCheckoutResult = {
  registration: Registration;
  payment: RegistrationPayment;
};

function requireUserId(userId: string): string {
  const trimmed = userId.trim();
  if (!trimmed) {
    throw new RegistrationError("auth_required", "Please sign in to continue registration.");
  }
  return trimmed;
}

async function loadOwnedRegistration(input: {
  userId: string;
  registrationId?: string;
}): Promise<Registration> {
  const userId = requireUserId(input.userId);
  const admin = getSupabaseAdmin();

  let query = admin
    .from("registrations")
    .select("*")
    .eq("program_key", DEFAULT_PROGRAM_KEY)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (input.registrationId) {
    query = query.eq("id", input.registrationId.trim());
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw mapDatabaseError(error);
  }

  if (!data) {
    throw new RegistrationError("not_found", "We could not find a registration to pay for.");
  }

  return mapRegistrationRow(data as RegistrationRow);
}

function assertCheckoutEligible(registration: Registration, userId: string): void {
  if (registration.userId !== userId) {
    throw new RegistrationError("forbidden", "This registration belongs to another account.");
  }

  if (registration.programKey !== DEFAULT_PROGRAM_KEY) {
    throw new RegistrationError("forbidden", "This registration is not eligible for checkout.");
  }

  if (
    !CHECKOUT_ELIGIBLE_STATUSES.includes(
      registration.status as (typeof CHECKOUT_ELIGIBLE_STATUSES)[number],
    )
  ) {
    throw new RegistrationError(
      "not_editable",
      "This registration is not eligible for payment at this time.",
    );
  }
}

/**
 * Resolve the authenticated user's checkout-eligible registration.
 */
export async function getCheckoutEligibleRegistration(userId: string): Promise<Registration> {
  const registration = await loadOwnedRegistration({ userId });
  assertCheckoutEligible(registration, requireUserId(userId));
  return registration;
}

/**
 * Transition registration to payment_pending and stage a pending payment row.
 * Called only after Stripe Checkout Session id is known.
 */
export async function beginRegistrationCheckout(
  input: BeginRegistrationCheckoutInput,
): Promise<BeginRegistrationCheckoutResult> {
  const userId = requireUserId(input.userId);
  const stripeSessionId = input.stripeSessionId.trim();

  if (!stripeSessionId) {
    throw new RegistrationError("validation", "Checkout session id is required.");
  }

  const registration = await getCheckoutEligibleRegistration(userId);
  const pricing = getRegistrationPricingConfig();
  const admin = getSupabaseAdmin();

  const { data: paymentRow, error: paymentError } = await admin
    .from("registration_payments")
    .insert({
      registration_id: registration.id,
      status: "pending",
      amount_cents: pricing.amountCents,
      currency: pricing.currency,
      stripe_session_id: stripeSessionId,
      checkout_type: REGISTRATION_CHECKOUT_TYPE,
    })
    .select("*")
    .single();

  if (paymentError) {
    if (paymentError.code === "23505") {
      throw new RegistrationError(
        "conflict",
        "A checkout session is already in progress for this registration.",
      );
    }
    throw mapDatabaseError(paymentError);
  }

  const nextStatus =
    registration.status === "payment_pending" ? "payment_pending" : "payment_pending";

  const { data: updatedRegistration, error: registrationError } = await admin
    .from("registrations")
    .update({
      status: nextStatus,
      amount_cents: pricing.amountCents,
      currency: pricing.currency,
      updated_by: userId,
    })
    .eq("id", registration.id)
    .eq("user_id", userId)
    .in("status", [...CHECKOUT_ELIGIBLE_STATUSES])
    .select("*")
    .single();

  if (registrationError || !updatedRegistration) {
    throw mapDatabaseError(
      registrationError ?? { message: "registration payment transition failed" },
    );
  }

  const payment = mapRegistrationPaymentRow(paymentRow as RegistrationPaymentRow);
  const updated = mapRegistrationRow(updatedRegistration as RegistrationRow);

  await writeRegistrationAuditEvent({
    action: "registration.checkout_started",
    registrationId: updated.id,
    userId,
    userEmail: updated.email,
    metadata: {
      stripe_session_id: stripeSessionId,
      registration_payment_id: payment.id,
      amount_cents: pricing.amountCents,
      currency: pricing.currency,
    },
  });

  return { registration: updated, payment };
}

export async function getLatestPendingRegistrationPayment(
  registrationId: string,
): Promise<RegistrationPayment | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("registration_payments")
    .select("*")
    .eq("registration_id", registrationId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw mapDatabaseError(error);
  }

  return data ? mapRegistrationPaymentRow(data as RegistrationPaymentRow) : null;
}

