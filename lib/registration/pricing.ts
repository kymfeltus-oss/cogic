import "server-only";

import { resolveRegistrationPricingConfig } from "@/lib/registration/pricing-core";

export type { RegistrationPricingConfig } from "@/lib/registration/pricing-core";

/**
 * Server-only Convocation registration fee configuration.
 * Fails closed when REGISTRATION_FEE_CENTS is absent or invalid.
 */
export function getRegistrationPricingConfig() {
  return resolveRegistrationPricingConfig({
    feeCents: process.env.REGISTRATION_FEE_CENTS,
    currency: process.env.REGISTRATION_CURRENCY,
  });
}

