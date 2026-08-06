import "server-only";

import { getRegistrationPricingConfig } from "@/lib/registration/pricing";
import { formatRegistrationFeeLabel } from "@/lib/registration/workflow";

/** Returns a display fee label, or null when pricing is not configured. */
export function getRegistrationFeeLabelOrNull(): string | null {
  try {
    const pricing = getRegistrationPricingConfig();
    return formatRegistrationFeeLabel(pricing.amountCents, pricing.currency);
  } catch {
    return null;
  }
}
