import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";

export type ChurchTaxProfileRow = {
  id: string;
  church_id: string;
  legal_name: string;
  ein: string;
  verification_status: string;
  certificate_bucket: string;
  certificate_object_path: string | null;
  certificate_content_type: string | null;
  certificate_byte_size: number | null;
  certificate_sha256: string | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  expires_on: string | null;
  owner_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TaxExemptReviewAction = "verify" | "reject";

export type PendingReviewTaxProfileRow = ChurchTaxProfileRow & {
  church_name: string | null;
};

export async function getChurchTaxProfileById(
  profileId: string,
): Promise<ChurchTaxProfileRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("church_tax_profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ChurchTaxProfileRow | null) ?? null;
}

/**
 * Lookup by church. Uses maybeSingle so unseeded churches return null
 * instead of throwing PGRST116 (0 rows) — never use .single() here.
 */
export async function getChurchTaxProfileByChurchId(
  churchId: string,
): Promise<ChurchTaxProfileRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("church_tax_profiles")
    .select("*")
    .eq("church_id", churchId)
    .maybeSingle();

  if (error) {
    // Defensive: treat classic .single() empty-result codes as null.
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  return (data as ChurchTaxProfileRow | null) ?? null;
}

/**
 * Platform-owner queue: profiles awaiting certificate audit.
 */
export async function listPendingReviewTaxProfiles(
  limit = 100,
): Promise<PendingReviewTaxProfileRow[]> {
  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(Math.floor(limit), 1), 200)
    : 100;

  const { data, error } = await getSupabaseAdmin()
    .from("church_tax_profiles")
    .select(
      "*, church_organizations ( id, name )",
    )
    .eq("verification_status", "pending_review")
    .order("uploaded_at", { ascending: true, nullsFirst: false })
    .limit(safeLimit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const source = row as ChurchTaxProfileRow & {
      church_organizations?:
        | { id: string; name: string | null }
        | { id: string; name: string | null }[]
        | null;
    };
    const org = Array.isArray(source.church_organizations)
      ? source.church_organizations[0]
      : source.church_organizations;
    const { church_organizations: _churchOrg, ...profile } = source;
    void _churchOrg;
    return {
      ...(profile as ChurchTaxProfileRow),
      church_name: org?.name?.trim() || null,
    };
  });
}

/**
 * Platform-owner mutator for tax-exempt review.
 * Schema stamps reviewer identity on reviewed_by / reviewed_at
 * (there is no verified_by / verified_at column in church_tax_profiles).
 */
export async function reviewChurchTaxProfile(input: {
  profileId: string;
  action: TaxExemptReviewAction;
  reviewerUserId: string;
  internalNotes: string | null;
}): Promise<ChurchTaxProfileRow> {
  const existing = await getChurchTaxProfileById(input.profileId);
  if (!existing) {
    throw Object.assign(new Error("Tax-exempt profile not found."), {
      status: 404,
    });
  }

  if (!existing.certificate_object_path) {
    throw Object.assign(
      new Error("Cannot review a profile that has no uploaded certificate object."),
      { status: 409 },
    );
  }

  if (
    existing.verification_status !== "pending_review" &&
    existing.verification_status !== "pending_upload"
  ) {
    throw Object.assign(
      new Error(
        `Profile cannot be reviewed from status '${existing.verification_status}'.`,
      ),
      { status: 409 },
    );
  }

  const reviewedAt = new Date().toISOString();
  const notes =
    typeof input.internalNotes === "string" && input.internalNotes.trim()
      ? input.internalNotes.trim().slice(0, 2000)
      : null;

  if (input.action === "verify") {
    const { data, error } = await getSupabaseAdmin()
      .from("church_tax_profiles")
      .update({
        verification_status: "verified",
        reviewed_by: input.reviewerUserId,
        reviewed_at: reviewedAt,
        rejection_reason: null,
        owner_notes: notes,
      })
      .eq("id", input.profileId)
      .select("*")
      .single();

    if (error || !data) {
      throw error ?? new Error("Unable to verify tax-exempt profile.");
    }
    return data as ChurchTaxProfileRow;
  }

  if (!notes || notes.length < 3) {
    throw Object.assign(
      new Error("internalNotes (min 3 characters) is required when rejecting."),
      { status: 400 },
    );
  }

  const { data, error } = await getSupabaseAdmin()
    .from("church_tax_profiles")
    .update({
      verification_status: "rejected",
      reviewed_by: input.reviewerUserId,
      reviewed_at: reviewedAt,
      rejection_reason: notes,
      owner_notes: notes,
    })
    .eq("id", input.profileId)
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Unable to reject tax-exempt profile.");
  }

  return data as ChurchTaxProfileRow;
}
