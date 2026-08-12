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

export const REGISTRATION_STEP_IDS = [
  "attendee",
  "product",
  "group",
  "policy",
  "housing",
  "review",
  "payment",
] as const;
export type RegistrationStepId = (typeof REGISTRATION_STEP_IDS)[number];

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
  draftLastStep: RegistrationStepId | null;
  rowVersion: number;
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
  salutation?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
  email?: string | null;
  mobilePhone?: string | null;
  assistantEmail?: string | null;
  streetAddress?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  gender?: string | null;
  requiresInterpretation?: boolean;
  preferredLanguage?: string | null;
  churchName?: string | null;
  pastorName?: string | null;
  jurisdiction?: string | null;
  draftLastStep?: RegistrationStepId | null;
  /** Legacy optional field — ignored by atomic draft RPC (server stamps amounts from products). */
  amountCents?: number | null;
  /** Legacy optional field — ignored by atomic draft RPC. */
  currency?: string;
};

/**
 * Identity-only primary draft payload for `save_primary_draft` /
 * `save_registration_primary_draft`. Product, price, status, and ownership
 * are never accepted from the client.
 */
export type RegistrationPrimaryDraftInput = {
  salutation?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
  email?: string | null;
  mobilePhone?: string | null;
  assistantEmail?: string | null;
  streetAddress?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  gender?: string | null;
  requiresInterpretation?: boolean;
  preferredLanguage?: string | null;
  churchName?: string | null;
  pastorName?: string | null;
  jurisdiction?: string | null;
  draftLastStep?: RegistrationStepId | null;
};

const PRIMARY_DRAFT_REJECTED_KEYS = [
  "amountCents",
  "amount_cents",
  "currency",
  "status",
  "userId",
  "user_id",
  "ownerUserId",
  "owner_user_id",
  "registrationProductId",
  "registration_product_id",
  "productId",
  "totalCents",
  "total_cents",
  "groupId",
  "group_id",
  "registrationId",
  "registration_id",
] as const;

function asOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  return value;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value !== "boolean") return undefined;
  return value;
}

function asOptionalStepId(value: unknown): RegistrationStepId | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  if (
    value === "attendee" ||
    value === "product" ||
    value === "group" ||
    value === "policy" ||
    value === "housing" ||
    value === "review" ||
    value === "payment"
  ) {
    return value;
  }
  return undefined;
}

/**
 * Allowlist-only parser for `save_primary_draft`.
 * Explicitly discards client-supplied pricing, status, product, and user identity.
 */
export function sanitizeRegistrationPrimaryDraftInput(
  raw: unknown,
): RegistrationPrimaryDraftInput {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  for (const rejectedKey of PRIMARY_DRAFT_REJECTED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(source, rejectedKey)) {
      // Drop silently — never trust client authority fields.
      delete source[rejectedKey];
    }
  }

  return {
    salutation: asOptionalString(source.salutation),
    firstName: asOptionalString(source.firstName),
    lastName: asOptionalString(source.lastName),
    suffix: asOptionalString(source.suffix),
    email: asOptionalString(source.email),
    mobilePhone: asOptionalString(source.mobilePhone),
    assistantEmail: asOptionalString(source.assistantEmail),
    streetAddress: asOptionalString(source.streetAddress),
    addressLine2: asOptionalString(source.addressLine2),
    city: asOptionalString(source.city),
    state: asOptionalString(source.state),
    postalCode: asOptionalString(source.postalCode),
    countryCode: asOptionalString(source.countryCode),
    gender: asOptionalString(source.gender),
    requiresInterpretation: asOptionalBoolean(source.requiresInterpretation),
    preferredLanguage: asOptionalString(source.preferredLanguage),
    churchName: asOptionalString(source.churchName),
    pastorName: asOptionalString(source.pastorName),
    jurisdiction: asOptionalString(source.jurisdiction),
    draftLastStep: asOptionalStepId(source.draftLastStep),
  };
}

export type RegistrationVersionContract = {
  groupVersion?: number | null;
  registrationVersion?: number | null;
};

export type RegistrationPrimaryDraftResult = {
  groupId: string;
  groupVersion: number;
  registrationId: string;
  registrationVersion: number;
  status: "draft";
  draftLastStep: RegistrationStepId | null;
};

export type RegistrationAtomicTransitionResult = {
  groupId: string;
  registrationId?: string;
  status: RegistrationStatus;
  groupVersion: number;
  totalCents?: number;
  currency?: string;
  transitionedMembers?: number;
  canceledMembers?: number;
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
  draft_last_step?: RegistrationStepId | null;
  row_version?: number;
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
    draftLastStep: row.draft_last_step ?? null,
    rowVersion: Number(row.row_version ?? 1),
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
