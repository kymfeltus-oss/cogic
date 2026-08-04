export const REGISTRATION_STATUSES = [
  "draft",
  "submitted",
  "payment_pending",
  "confirmed",
  "canceled",
  "refunded",
] as const;

export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const ACTIVE_REGISTRATION_STATUSES = [
  "draft",
  "submitted",
  "payment_pending",
  "confirmed",
] as const;

export type ActiveRegistrationStatus = (typeof ACTIVE_REGISTRATION_STATUSES)[number];

export const REGISTRATION_PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "canceled",
  "refunded",
] as const;

export type RegistrationPaymentStatus = (typeof REGISTRATION_PAYMENT_STATUSES)[number];

export const DEFAULT_PROGRAM_KEY = "cogic-stream-2026";
export const REGISTRATION_CHECKOUT_TYPE = "registration" as const;
export const DEFAULT_REGISTRATION_CURRENCY = "usd";

export type Registration = {
  id: string;
  programKey: string;
  userId: string | null;
  status: RegistrationStatus;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  mobilePhone: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  churchName: string | null;
  pastorName: string | null;
  jurisdiction: string | null;
  amountCents: number | null;
  currency: string;
  submittedAt: string | null;
  confirmedAt: string | null;
  canceledAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type RegistrationPayment = {
  id: string;
  registrationId: string;
  status: RegistrationPaymentStatus;
  amountCents: number;
  currency: string;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  checkoutType: typeof REGISTRATION_CHECKOUT_TYPE;
  createdAt: string;
  updatedAt: string;
};

/** Partial draft fields — incomplete OK until submit. */
export type RegistrationDraftInput = {
  programKey?: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  mobilePhone?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  churchName?: string | null;
  pastorName?: string | null;
  jurisdiction?: string | null;
  amountCents?: number | null;
  currency?: string;
};

/** All mandatory Convocation fields required to move to submitted. */
export type RegistrationSubmissionInput = {
  firstName: string;
  lastName: string;
  email: string;
  mobilePhone: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  churchName: string;
  pastorName: string;
  jurisdiction: string;
  amountCents?: number | null;
  currency?: string;
};

export type RegistrationRow = {
  id: string;
  program_key: string;
  user_id: string | null;
  status: RegistrationStatus;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_phone: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  church_name: string | null;
  pastor_name: string | null;
  jurisdiction: string | null;
  amount_cents: number | null;
  currency: string;
  submitted_at: string | null;
  confirmed_at: string | null;
  canceled_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type RegistrationPaymentRow = {
  id: string;
  registration_id: string;
  status: RegistrationPaymentStatus;
  amount_cents: number;
  currency: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  checkout_type: string;
  created_at: string;
  updated_at: string;
};

export function mapRegistrationRow(row: RegistrationRow): Registration {
  return {
    id: row.id,
    programKey: row.program_key,
    userId: row.user_id,
    status: row.status,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    mobilePhone: row.mobile_phone,
    streetAddress: row.street_address,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    churchName: row.church_name,
    pastorName: row.pastor_name,
    jurisdiction: row.jurisdiction,
    amountCents: row.amount_cents,
    currency: row.currency,
    submittedAt: row.submitted_at,
    confirmedAt: row.confirmed_at,
    canceledAt: row.canceled_at,
    refundedAt: row.refunded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}

export function mapRegistrationPaymentRow(
  row: RegistrationPaymentRow,
): RegistrationPayment {
  return {
    id: row.id,
    registrationId: row.registration_id,
    status: row.status,
    amountCents: row.amount_cents,
    currency: row.currency,
    stripeSessionId: row.stripe_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    checkoutType: REGISTRATION_CHECKOUT_TYPE,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
