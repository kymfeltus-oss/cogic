import { RegistrationError } from "@/lib/registration/errors";

export const REGISTRATION_CORRECTION_ALLOWLIST = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "interpretationLanguage",
  "juniorDob",
] as const;

export type RegistrationCorrectionField = (typeof REGISTRATION_CORRECTION_ALLOWLIST)[number];

const FORBIDDEN_CORRECTION_KEYS = [
  "amount_cents",
  "amountCents",
  "status",
  "user_id",
  "userId",
  "price_cents",
  "priceCents",
  "total_cents",
  "totalCents",
  "currency",
  "registration_product_id",
  "registrationProductId",
  "registration_group_id",
  "registrationGroupId",
  "stripe_session_id",
  "stripeSessionId",
  "stripe_payment_intent_id",
  "stripePaymentIntentId",
  "row_version",
  "rowVersion",
] as const;

/**
 * Sanitize owner correction payload: allowlist only, fail closed on authority fields.
 */
export function sanitizeRegistrationCorrectionInput(
  raw: unknown,
): Partial<Record<RegistrationCorrectionField, string>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new RegistrationError("validation", "Correction payload must be an object.");
  }

  const source = raw as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    if ((FORBIDDEN_CORRECTION_KEYS as readonly string[]).includes(key)) {
      throw new RegistrationError(
        "validation",
        `Correction rejects transactional/authority field: ${key}.`,
      );
    }
    if (!(REGISTRATION_CORRECTION_ALLOWLIST as readonly string[]).includes(key)) {
      throw new RegistrationError(
        "validation",
        `Correction rejects non-allowlisted field: ${key}.`,
      );
    }
  }

  const corrections: Partial<Record<RegistrationCorrectionField, string>> = {};
  for (const field of REGISTRATION_CORRECTION_ALLOWLIST) {
    if (!(field in source)) continue;
    const value = source[field];
    if (value === null || value === undefined) {
      throw new RegistrationError("validation", `${field} cannot be null.`);
    }
    if (typeof value !== "string") {
      throw new RegistrationError("validation", `${field} must be a string.`);
    }
    corrections[field] = value.trim();
  }

  if (Object.keys(corrections).length === 0) {
    throw new RegistrationError(
      "validation",
      "At least one allowlisted correction field is required.",
    );
  }

  return corrections;
}
