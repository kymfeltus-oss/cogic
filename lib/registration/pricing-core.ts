import { DEFAULT_REGISTRATION_CURRENCY } from "@/lib/registration/types";
import { RegistrationError } from "@/lib/registration/errors";

export type RegistrationPricingConfig = {
  amountCents: number;
  currency: string;
};

function parsePositiveIntegerCents(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function parseCurrency(raw: string | undefined): string {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return DEFAULT_REGISTRATION_CURRENCY;
  if (!/^[a-z]{3}$/.test(normalized)) {
    throw new RegistrationError(
      "unavailable",
      "Registration currency configuration is invalid.",
    );
  }
  return normalized;
}

export function resolveRegistrationPricingConfig(input: {
  feeCents?: string;
  currency?: string;
}): RegistrationPricingConfig {
  const amountCents = parsePositiveIntegerCents(input.feeCents);

  if (amountCents === null) {
    throw new RegistrationError(
      "unavailable",
      "Registration pricing is not configured. Set REGISTRATION_FEE_CENTS before accepting payments.",
    );
  }

  if (amountCents === 0) {
    throw new RegistrationError(
      "unavailable",
      "Registration pricing must be greater than zero.",
    );
  }

  return {
    amountCents,
    currency: parseCurrency(input.currency),
  };
}

