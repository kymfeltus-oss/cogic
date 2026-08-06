import type { Registration, RegistrationStatus } from "@/lib/registration/types";

export type RegistrationViewMode =
  | "wizard"
  | "submitted"
  | "payment_pending"
  | "confirmed"
  | "terminal";

export function isRegistrationEditable(status: RegistrationStatus): boolean {
  return status === "draft";
}

export function resolveRegistrationViewMode(
  registration: Registration | null,
): RegistrationViewMode {
  if (!registration) return "wizard";

  switch (registration.status) {
    case "draft":
      return "wizard";
    case "submitted":
      return "submitted";
    case "payment_pending":
      return "payment_pending";
    case "confirmed":
      return "confirmed";
    case "canceled":
    case "refunded":
      return "terminal";
    default:
      return "terminal";
  }
}

export function registrationReference(registration: Registration): string {
  return registration.id.slice(0, 8).toUpperCase();
}

export function shouldCreateNewDraft(status: RegistrationStatus | null): boolean {
  if (!status) return true;
  return status === "canceled" || status === "refunded";
}

/** Fields the client may send for draft updates — never identity/lifecycle. */
export const DRAFT_EDITABLE_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "mobilePhone",
  "streetAddress",
  "city",
  "state",
  "postalCode",
  "churchName",
  "pastorName",
  "jurisdiction",
] as const;

export type DraftEditableField = (typeof DRAFT_EDITABLE_FIELDS)[number];

export function pickDraftEditableFields(
  input: Record<string, unknown>,
): Partial<Record<DraftEditableField, string | null>> {
  const picked: Partial<Record<DraftEditableField, string | null>> = {};

  for (const field of DRAFT_EDITABLE_FIELDS) {
    if (!(field in input)) continue;
    const value = input[field];
    if (value == null) {
      picked[field] = null;
      continue;
    }
    if (typeof value === "string") {
      picked[field] = value;
    }
  }

  return picked;
}

export function honestSubmittedCopy(): {
  title: string;
  body: string;
  statusLabel: string;
} {
  return {
    title: "Registration information received",
    body: "Your information has been received. Complete payment to confirm your Convocation registration and receive your credential.",
    statusLabel: "Submitted — payment required",
  };
}

export function honestPaymentPendingCopy(): {
  title: string;
  body: string;
  statusLabel: string;
} {
  return {
    title: "Registration payment is still pending",
    body: "Your registration is on file. Finish checkout to confirm payment and continue to credential issuance.",
    statusLabel: "Payment pending",
  };
}

export function honestConfirmedCopy(): {
  title: string;
  body: string;
  statusLabel: string;
} {
  return {
    title: "Registration confirmed",
    body: "Your Convocation registration payment was confirmed. Your credential will appear in My Convocation when issuance completes.",
    statusLabel: "Confirmed",
  };
}

/** Format server-validated registration fee for attendee UI. */
export function formatRegistrationFeeLabel(
  amountCents: number,
  currency: string,
): string {
  try {
    return (amountCents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return `$${(amountCents / 100).toFixed(2)}`;
  }
}
