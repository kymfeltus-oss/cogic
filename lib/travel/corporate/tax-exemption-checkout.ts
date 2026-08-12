/**
 * Corporate tax-exemption claim detection + server verification for travel checkout.
 * Keep free of `server-only` where possible for claim helpers; DB lookup is server-only.
 */

export const CHURCH_TAX_EXEMPT_TRAVEL_LABEL = "Church Tax-Exempt Business Travel";

/** Client may claim intent; never accepts verification_status or tax_profile_id as authority. */
export function clientClaimsChurchTaxExemptTravel(
  body: Record<string, unknown> | null | undefined,
  offer?: Record<string, unknown> | null,
): boolean {
  const sources: unknown[] = [];
  if (body && typeof body === "object") {
    sources.push(
      body.taxExemptClaim,
      body.tax_exempt_claim,
      body.churchTaxExempt,
      body.church_tax_exempt,
      body.travelPurpose,
      body.travel_purpose,
      body.travelCategory,
      body.travel_category,
      body.businessTravelType,
      body.business_travel_type,
    );
  }
  if (offer && typeof offer === "object") {
    sources.push(
      offer.taxExemptClaim,
      offer.churchTaxExempt,
      offer.travelPurpose,
      offer.travelCategory,
      offer.businessTravelType,
    );
  }

  for (const value of sources) {
    if (value === true || value === 1 || value === "1") return true;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (
        normalized === "church_tax_exempt" ||
        normalized === "church-tax-exempt" ||
        normalized === "tax_exempt" ||
        /church\s*tax-?exempt\s*business\s*travel/.test(normalized)
      ) {
        return true;
      }
    }
  }
  return false;
}

export type CorporateTaxExemptionDecision = {
  clientClaimed: boolean;
  applied: boolean;
  taxProfileId: string | null;
  verificationStatus: string | null;
  churchId: string | null;
  municipalTaxCents: number;
  chargedTaxCents: number;
  reason: string;
};

/**
 * Apply municipal tax to the Stripe grand total.
 * Provider fare is treated as tax-inclusive when municipalTaxCents > 0:
 * - not exempt → charge inclusive fare + fee (taxes retained)
 * - exempt → charge (fare - municipal tax) + fee, charged tax = 0
 */
export function applyCorporateTaxExemptionToTotals(input: {
  fareCents: number;
  serviceFeeCents: number;
  municipalTaxCents: number;
  decision: Pick<CorporateTaxExemptionDecision, "applied">;
}): {
  fareCents: number;
  taxAmountCents: number;
  serviceFeeCents: number;
  totalAmountCents: number;
} {
  const municipalTaxCents = Math.max(0, Math.round(input.municipalTaxCents) || 0);
  const fareCents = Math.max(0, Math.round(input.fareCents) || 0);
  const serviceFeeCents = Math.max(0, Math.round(input.serviceFeeCents) || 0);

  if (input.decision.applied && municipalTaxCents > 0) {
    const exemptFare = Math.max(0, fareCents - municipalTaxCents);
    return {
      fareCents: exemptFare,
      taxAmountCents: 0,
      serviceFeeCents,
      totalAmountCents: exemptFare + serviceFeeCents,
    };
  }

  return {
    fareCents,
    taxAmountCents: municipalTaxCents,
    serviceFeeCents,
    totalAmountCents: fareCents + serviceFeeCents,
  };
}
