import "server-only";

import { mapDatabaseError, RegistrationError } from "@/lib/registration/errors";
import {
  DEFAULT_PROGRAM_KEY,
  DEFAULT_REGISTRATION_CURRENCY,
  mapRegistrationPaymentRow,
  mapRegistrationRow,
  type Registration,
  type RegistrationPayment,
  type RegistrationPaymentRow,
  type RegistrationPaymentStatus,
  type RegistrationRow,
  type RegistrationStatus,
} from "@/lib/registration/types";
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
    .eq("is_primary_registrant", true)
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

function mapCheckoutRpcRegistration(payload: Record<string, unknown>, fallback: Registration): Registration {
  return {
    ...fallback,
    id: String(payload.registration_id ?? fallback.id),
    status: String(payload.registration_status ?? fallback.status) as RegistrationStatus,
    amountCents:
      typeof payload.registration_amount_cents === "number"
        ? payload.registration_amount_cents
        : fallback.amountCents,
    currency:
      typeof payload.registration_currency === "string" && payload.registration_currency.trim()
        ? payload.registration_currency
        : fallback.currency || DEFAULT_REGISTRATION_CURRENCY,
    email:
      typeof payload.registration_email === "string"
        ? payload.registration_email
        : fallback.email,
    rowVersion:
      typeof payload.registration_row_version === "number"
        ? payload.registration_row_version
        : fallback.rowVersion,
  };
}

function mapCheckoutRpcPayment(payload: Record<string, unknown>): RegistrationPayment {
  const paymentId = payload.payment_id;
  if (typeof paymentId !== "string" || !paymentId.trim()) {
    throw new RegistrationError("unavailable", "Checkout did not return a payment id.");
  }

  const amountCents = payload.payment_amount_cents;
  if (typeof amountCents !== "number" || amountCents <= 0) {
    throw new RegistrationError("unavailable", "Checkout did not return an authoritative amount.");
  }

  return {
    id: paymentId,
    registrationId: String(payload.registration_id),
    status: String(payload.payment_status ?? "pending") as RegistrationPaymentStatus,
    amountCents,
    currency:
      typeof payload.payment_currency === "string" && payload.payment_currency.trim()
        ? payload.payment_currency
        : DEFAULT_REGISTRATION_CURRENCY,
    stripeSessionId:
      typeof payload.stripe_session_id === "string" ? payload.stripe_session_id : null,
    stripePaymentIntentId: null,
    checkoutType: "registration",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Transition registration to payment_pending and stage a pending payment row.
 * Amounts/status are stamped inside begin_registration_checkout from locked rows.
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
  if (registration.amountCents === null || registration.amountCents <= 0) {
    throw new RegistrationError("validation", "This registration does not require payment.");
  }

  const { data, error } = await getSupabaseAdmin().rpc("begin_registration_checkout", {
    p_user_id: userId,
    p_stripe_session_id: stripeSessionId,
  });

  if (error) {
    if (error.code === "23505") {
      throw new RegistrationError(
        "conflict",
        "A checkout session is already in progress for this registration.",
      );
    }
    throw mapDatabaseError(error);
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  if (payload.ok !== true || !payload.registration_id || !payload.payment_id) {
    throw new RegistrationError("unavailable", "Unable to start registration checkout.");
  }

  return {
    registration: mapCheckoutRpcRegistration(payload, registration),
    payment: mapCheckoutRpcPayment(payload),
  };
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

export async function cancelPendingRegistrationCheckout(input: {
  userId: string;
  registrationId: string;
  stripeSessionId: string;
}): Promise<void> {
  const userId = requireUserId(input.userId);
  const registration = await loadOwnedRegistration({
    userId,
    registrationId: input.registrationId,
  });
  const stripeSessionId = input.stripeSessionId.trim();
  if (!stripeSessionId) {
    throw new RegistrationError("validation", "Checkout session id is required.");
  }

  const { data, error } = await getSupabaseAdmin().rpc("cancel_pending_registration_checkout", {
    p_user_id: userId,
    p_registration_id: registration.id,
    p_stripe_session_id: stripeSessionId,
  });

  if (error) {
    throw mapDatabaseError(error);
  }

  const payload = (data ?? {}) as { ok?: boolean };
  if (payload.ok !== true) {
    throw new RegistrationError("unavailable", "Unable to cancel pending registration checkout.");
  }
}
