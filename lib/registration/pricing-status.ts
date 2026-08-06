import "server-only";

import { RegistrationError } from "@/lib/registration/errors";
import { getRegistrationPricingConfig } from "@/lib/registration/pricing";

export function isRegistrationPricingConfigured(): boolean {
  try {
    getRegistrationPricingConfig();
    return true;
  } catch (error) {
    if (error instanceof RegistrationError && error.code === "unavailable") {
      return false;
    }
    throw error;
  }
}

