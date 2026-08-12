import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  listPendingReviewTaxProfiles,
  reviewChurchTaxProfile,
  type ChurchTaxProfileRow,
} from "@/lib/travel/corporate/tax-exempt-review";

/**
 * Operator-only smoke helpers for /owner/travel tax desk.
 * Does NOT invent certificates or skip pending_review — verify requires real uploaded objects.
 */

export async function operatorListPendingTaxProfiles(limit = 50) {
  return listPendingReviewTaxProfiles(limit);
}

export async function operatorReviewTaxProfile(input: {
  profileId: string;
  action: "verify" | "reject";
  reviewerUserId: string;
  internalNotes?: string | null;
}): Promise<ChurchTaxProfileRow> {
  if (process.env.OPERATOR_SMOKE_ENABLED?.trim().toLowerCase() !== "true") {
    throw Object.assign(
      new Error("OPERATOR_SMOKE_ENABLED=true is required for CLI smoke mutators."),
      { status: 403 },
    );
  }

  return reviewChurchTaxProfile({
    profileId: input.profileId,
    action: input.action,
    reviewerUserId: input.reviewerUserId,
    internalNotes: input.internalNotes ?? null,
  });
}

export async function operatorGetTaxProfileByChurchId(churchId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("church_tax_profiles")
    .select("*")
    .eq("church_id", churchId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ChurchTaxProfileRow | null) ?? null;
}
