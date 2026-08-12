import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  applyCorporateTaxExemptionToTotals,
  type CorporateTaxExemptionDecision,
} from "@/lib/travel/corporate/tax-exemption-checkout";

/**
 * Resolve whether a checkout user may receive 501(c)(3) municipal tax relief.
 * Church identity comes from memberships for the session userId — never from body.
 * Only verification_status === 'verified' permits exemption.
 */
export async function resolveCorporateTaxExemptionForCheckout(input: {
  userId: string;
  clientClaimed: boolean;
  municipalTaxCents: number;
}): Promise<CorporateTaxExemptionDecision> {
  const municipalTaxCents = Math.max(0, Math.round(input.municipalTaxCents) || 0);

  if (!input.clientClaimed) {
    return {
      clientClaimed: false,
      applied: false,
      taxProfileId: null,
      verificationStatus: null,
      churchId: null,
      municipalTaxCents,
      chargedTaxCents: municipalTaxCents,
      reason: "no_client_claim",
    };
  }

  const admin = getSupabaseAdmin();
  const { data: memberships, error: membershipError } = await admin
    .from("church_memberships")
    .select("church_id,role,updated_at")
    .eq("user_id", input.userId)
    .order("updated_at", { ascending: false });

  if (membershipError) {
    console.error("[tax-exemption.checkout] membership lookup failed", {
      message: membershipError.message,
    });
    return {
      clientClaimed: true,
      applied: false,
      taxProfileId: null,
      verificationStatus: null,
      churchId: null,
      municipalTaxCents,
      chargedTaxCents: municipalTaxCents,
      reason: "membership_lookup_failed",
    };
  }

  const churchId = String(memberships?.[0]?.church_id || "").trim() || null;
  if (!churchId) {
    return {
      clientClaimed: true,
      applied: false,
      taxProfileId: null,
      verificationStatus: null,
      churchId: null,
      municipalTaxCents,
      chargedTaxCents: municipalTaxCents,
      reason: "no_church_membership",
    };
  }

  const { data: profile, error: profileError } = await admin
    .from("church_tax_profiles")
    .select("id,verification_status")
    .eq("church_id", churchId)
    .maybeSingle();

  if (profileError) {
    console.error("[tax-exemption.checkout] tax profile lookup failed", {
      message: profileError.message,
    });
    return {
      clientClaimed: true,
      applied: false,
      taxProfileId: null,
      verificationStatus: null,
      churchId,
      municipalTaxCents,
      chargedTaxCents: municipalTaxCents,
      reason: "tax_profile_lookup_failed",
    };
  }

  const verificationStatus = profile?.verification_status
    ? String(profile.verification_status)
    : null;
  const taxProfileId = profile?.id ? String(profile.id) : null;

  if (verificationStatus !== "verified" || !taxProfileId) {
    return {
      clientClaimed: true,
      applied: false,
      taxProfileId,
      verificationStatus,
      churchId,
      municipalTaxCents,
      chargedTaxCents: municipalTaxCents,
      reason:
        verificationStatus == null
          ? "no_tax_profile"
          : `status_not_verified:${verificationStatus}`,
    };
  }

  return {
    clientClaimed: true,
    applied: true,
    taxProfileId,
    verificationStatus: "verified",
    churchId,
    municipalTaxCents,
    chargedTaxCents: 0,
    reason: "verified_profile",
  };
}

export function buildTaxExemptionSnapshotFields(
  decision: CorporateTaxExemptionDecision,
): Record<string, unknown> {
  return {
    tax_profile_id: decision.applied ? decision.taxProfileId : null,
    taxExemption: {
      clientClaimed: decision.clientClaimed,
      applied: decision.applied,
      taxProfileId: decision.applied ? decision.taxProfileId : null,
      verificationStatus: decision.verificationStatus,
      churchId: decision.churchId,
      municipalTaxCents: decision.municipalTaxCents,
      chargedTaxCents: decision.chargedTaxCents,
      reason: decision.reason,
    },
  };
}

export { applyCorporateTaxExemptionToTotals };
