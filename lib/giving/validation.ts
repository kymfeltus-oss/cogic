import { getGivingFund, isActiveGivingFundKey } from "@/lib/giving/funds";
import type {
  GivingCheckoutRequest,
  GivingFundKey,
  GivingPaymentMethodId,
} from "@/lib/giving/types";

export const MIN_GIVING_AMOUNT_CENTS = 50;
export const MAX_GIVING_AMOUNT_CENTS = 1_000_000_00; // $1,000,000.00
export const MAX_GIVING_NOTE_LENGTH = 200;
export const QUICK_GIVING_AMOUNTS_CENTS = [2500, 5000, 10000, 25000] as const;

export type GivingValidationResult =
  | { ok: true; value: GivingCheckoutRequest }
  | { ok: false; error: string };

function sanitizeNote(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_GIVING_NOTE_LENGTH);
}

export function validateGivingCheckoutInput(input: {
  amountInCents?: unknown;
  fundKey?: unknown;
  note?: unknown;
  source?: unknown;
  paymentMethod?: unknown;
  sourceType?: unknown;
  mediaId?: unknown;
  eventId?: unknown;
  eventOccurrenceId?: unknown;
  collectionId?: unknown;
  programKey?: unknown;
}): GivingValidationResult {
  const amountInCents = input.amountInCents;

  if (
    typeof amountInCents !== "number" ||
    !Number.isInteger(amountInCents) ||
    amountInCents < MIN_GIVING_AMOUNT_CENTS
  ) {
    return { ok: false, error: "Please enter a valid gift amount of at least $0.50." };
  }

  if (amountInCents > MAX_GIVING_AMOUNT_CENTS) {
    return { ok: false, error: "That amount exceeds the allowed maximum." };
  }

  const fundKeyRaw = typeof input.fundKey === "string" ? input.fundKey.trim() : "";
  if (!isActiveGivingFundKey(fundKeyRaw)) {
    return { ok: false, error: "Please select a valid fund." };
  }

  const fund = getGivingFund(fundKeyRaw);
  if (!fund?.active) {
    return { ok: false, error: "That fund is not available." };
  }

  const note = sanitizeNote(input.note);
  const source =
    typeof input.source === "string" && input.source.trim()
      ? input.source.trim().slice(0, 80)
      : "cogic-giving";
  const paymentMethodRaw =
    typeof input.paymentMethod === "string" ? input.paymentMethod.trim() : "card";
  if (!["card", "apple_pay", "ach"].includes(paymentMethodRaw)) {
    return { ok: false, error: "Please select a valid payment method." };
  }

  const optionalUuid = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        trimmed,
      )
    ) {
      return undefined;
    }
    return trimmed;
  };

  const sourceTypeRaw =
    typeof input.sourceType === "string" ? input.sourceType.trim() : undefined;

  return {
    ok: true,
    value: {
      amountInCents,
      fundKey: fundKeyRaw as GivingFundKey,
      note,
      frequency: "one_time",
      source,
      paymentMethod: paymentMethodRaw as GivingPaymentMethodId,
      sourceType: sourceTypeRaw as GivingCheckoutRequest["sourceType"],
      mediaId: optionalUuid(input.mediaId),
      eventId: optionalUuid(input.eventId),
      eventOccurrenceId: optionalUuid(input.eventOccurrenceId),
      collectionId: optionalUuid(input.collectionId),
      programKey:
        typeof input.programKey === "string" && input.programKey.trim()
          ? input.programKey.trim().slice(0, 80)
          : undefined,
    },
  };
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
