import { NextResponse } from "next/server";
import { resolveServerOrgContext } from "@/lib/org/session-org-context";
import {
  getChurchTaxProfile,
  isChurchTaxProfileFallback,
} from "@/lib/travel/corporate/tax-exempt-profile";

export const dynamic = "force-dynamic";

const LEADERSHIP_ROLES = new Set(["Pastor", "Overseer"]);

/**
 * GET /api/travel/corporate/tax-exempt
 *
 * Pastor/Overseer status for the session church tax profile.
 * Unseeded churches return 200 + pending_upload fallback (upload UI can mount).
 */
export async function GET(request: Request) {
  const context = await resolveServerOrgContext(request);
  if (!context || !context.churchId || !LEADERSHIP_ROLES.has(context.role)) {
    return NextResponse.json(
      { error: "Pastor or Overseer membership is required." },
      { status: 403 },
    );
  }

  let row;
  try {
    row = await getChurchTaxProfile(context.churchId);
  } catch (error) {
    console.error("[tax-exempt.status] profile lookup failed", {
      message: error instanceof Error ? error.message : String(error),
      code:
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code || "")
          : undefined,
    });
    return NextResponse.json({ error: "Unable to load tax profile." }, { status: 500 });
  }

  if (isChurchTaxProfileFallback(row)) {
    return NextResponse.json(
      {
        churchId: context.churchId,
        churchName: context.churchName,
        role: context.role,
        canUpload: true,
        profile: null,
        verification_status: row.verification_status,
        legal_name: row.legal_name,
        ein: row.ein,
        is_fallback_initialization: true,
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" },
      },
    );
  }

  const status = row.verification_status;
  const canUpload = status === "pending_upload" || status === "rejected";

  return NextResponse.json(
    {
      churchId: context.churchId,
      churchName: context.churchName,
      role: context.role,
      canUpload,
      profile: {
        id: row.id,
        legalName: row.legal_name,
        ein: row.ein,
        verificationStatus: row.verification_status,
        rejectionReason: row.rejection_reason,
        uploadedAt: row.uploaded_at,
        reviewedAt: row.reviewed_at,
        certificateContentType: row.certificate_content_type,
        certificateByteSize: row.certificate_byte_size,
      },
      verification_status: row.verification_status,
      legal_name: row.legal_name,
      ein: row.ein,
      is_fallback_initialization: false,
    },
    {
      status: 200,
      headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" },
    },
  );
}
