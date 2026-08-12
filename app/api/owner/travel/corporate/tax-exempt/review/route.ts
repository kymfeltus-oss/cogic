import { NextResponse } from "next/server";
import { resolveServerOrgContext } from "@/lib/org/session-org-context";
import { ownerJsonResponse } from "@/lib/owner/api-response";
import {
  listPendingReviewTaxProfiles,
  reviewChurchTaxProfile,
} from "@/lib/travel/corporate/tax-exempt-review";

export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/owner/travel/corporate/tax-exempt/review
 *
 * Lists church_tax_profiles currently in pending_review for the owner desk.
 */
export async function GET(request: Request) {
  const context = await resolveServerOrgContext(request);
  if (!context || context.isPlatformOwner !== true) {
    return NextResponse.json(
      { error: "Platform owner privileges are required." },
      { status: 403 },
    );
  }

  const limitRaw = new URL(request.url).searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 100;

  try {
    const profiles = await listPendingReviewTaxProfiles(limit);
    return ownerJsonResponse({ profiles });
  } catch (error) {
    console.error("[owner.tax-exempt.review] list failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Unable to load pending tax-exempt profiles." },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/owner/travel/corporate/tax-exempt/review
 *
 * Platform-owner audit of church 501(c)(3) certificates.
 * Requires context.isPlatformOwner === true (403 otherwise).
 * Reviewer identity is stamped on reviewed_by / reviewed_at (schema columns).
 */
export async function PATCH(request: Request) {
  const context = await resolveServerOrgContext(request);
  if (!context || context.isPlatformOwner !== true) {
    return NextResponse.json(
      { error: "Platform owner privileges are required." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const source = body as Record<string, unknown>;

  if (
    "verification_status" in source ||
    "verificationStatus" in source ||
    "reviewed_by" in source ||
    "reviewed_at" in source ||
    "verified_by" in source ||
    "verified_at" in source ||
    "userId" in source ||
    "user_id" in source
  ) {
    return NextResponse.json(
      { error: "Client-supplied verification or reviewer identity fields are rejected." },
      { status: 400 },
    );
  }

  const profileId = String(source.profileId ?? source.profile_id ?? "").trim();
  const action = String(source.action ?? "").trim().toLowerCase();
  const notesRaw = source.internalNotes ?? source.internal_notes ?? source.ownerNotes;
  const internalNotes =
    typeof notesRaw === "string" && notesRaw.trim() ? notesRaw.trim() : null;

  if (!UUID.test(profileId)) {
    return NextResponse.json({ error: "profileId must be a valid UUID." }, { status: 400 });
  }
  if (action !== "verify" && action !== "reject") {
    return NextResponse.json(
      { error: "action must be 'verify' or 'reject'." },
      { status: 400 },
    );
  }

  try {
    const profile = await reviewChurchTaxProfile({
      profileId,
      action,
      reviewerUserId: context.userId,
      internalNotes,
    });

    return ownerJsonResponse({
      profile,
      // Schema columns reviewed_* fulfill the verify audit stamp requested as verified_*.
      verified_by: profile.reviewed_by,
      verified_at: profile.reviewed_at,
    });
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status?: number }).status)
        : 500;
    const message = error instanceof Error ? error.message : "Review failed.";

    if (status === 400 || status === 404 || status === 409) {
      return NextResponse.json({ error: message }, { status });
    }

    console.error("[owner.tax-exempt.review] failed", { message });
    return NextResponse.json({ error: "Unable to update tax-exempt profile." }, { status: 500 });
  }
}
