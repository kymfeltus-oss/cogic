import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveServerOrgContext } from "@/lib/org/session-org-context";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  isTaxExemptUploadValidationError,
  sanitizeTaxExemptUploadRequest,
  TAX_EXEMPT_CERTIFICATE_BUCKET,
  TAX_EXEMPT_CERTIFICATE_MAX_BYTES,
  taxExemptCertificateObjectPath,
} from "@/lib/travel/corporate/tax-exempt";

export const dynamic = "force-dynamic";

const LEADERSHIP_ROLES = new Set(["Pastor", "Overseer"]);

type TaxProfileRow = {
  id: string;
  verification_status: string;
};

async function clearCertificateFields(input: {
  profileId: string;
  churchId: string;
}) {
  await getSupabaseAdmin()
    .from("church_tax_profiles")
    .update({
      certificate_object_path: null,
      certificate_content_type: null,
      certificate_byte_size: null,
      certificate_sha256: null,
      uploaded_at: null,
      verification_status: "pending_upload",
    })
    .eq("id", input.profileId)
    .eq("church_id", input.churchId);
}

/**
 * POST /api/travel/corporate/tax-exempt/upload
 *
 * Pastor/Overseer signed upload session for 501(c)(3) certificates.
 * 1) resolveServerOrgContext — empty or non-leadership → 403
 * 2) Validate legal_name, ein, mime_type
 * 3) Block when church already has verification_status = verified (409)
 * 4) Persist pending_upload, then mint short-lived signed upload URL
 * 5) On sign failure, clear certificate fields and return 500
 */
export async function POST(request: Request) {
  const context = await resolveServerOrgContext(request);
  if (!context || !context.churchId || !LEADERSHIP_ROLES.has(context.role)) {
    return NextResponse.json(
      { error: "Pastor or Overseer membership is required." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sanitized = sanitizeTaxExemptUploadRequest(body);
  if (isTaxExemptUploadValidationError(sanitized)) {
    return NextResponse.json({ error: sanitized.error }, { status: sanitized.status });
  }

  const admin = getSupabaseAdmin();
  const churchId = context.churchId;

  const { data: existing, error: lookupError } = await admin
    .from("church_tax_profiles")
    .select("id,verification_status")
    .eq("church_id", churchId)
    .maybeSingle();

  if (lookupError) {
    console.error("[tax-exempt.upload] profile lookup failed", {
      message: lookupError.message,
      code: lookupError.code,
    });
    return NextResponse.json({ error: "Unable to load tax profile." }, { status: 500 });
  }

  const existingRow = existing as TaxProfileRow | null;
  if (existingRow?.verification_status === "verified") {
    return NextResponse.json(
      {
        error:
          "A verified tax-exempt profile already exists for this church. Contact an application owner to revise it.",
      },
      { status: 409 },
    );
  }

  const profileId = existingRow?.id ?? randomUUID();
  const objectPath = taxExemptCertificateObjectPath({
    churchId,
    profileId,
    mimeType: sanitized.mimeType,
  });

  const profilePayload = {
    legal_name: sanitized.legalName,
    ein: sanitized.ein,
    verification_status: "pending_upload" as const,
    certificate_bucket: TAX_EXEMPT_CERTIFICATE_BUCKET,
    certificate_object_path: objectPath,
    certificate_content_type: sanitized.mimeType,
    certificate_byte_size: sanitized.fileSize,
    certificate_sha256: null,
    uploaded_by: context.userId,
    uploaded_at: null,
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    expires_on: null,
  };

  const writeResult = existingRow
    ? await admin
        .from("church_tax_profiles")
        .update(profilePayload)
        .eq("id", existingRow.id)
        .eq("church_id", churchId)
    : await admin.from("church_tax_profiles").insert({
        id: profileId,
        church_id: churchId,
        ...profilePayload,
      });

  if (writeResult.error) {
    console.error("[tax-exempt.upload] profile write failed", {
      message: writeResult.error.message,
      code: writeResult.error.code,
    });
    return NextResponse.json(
      { error: "Unable to prepare tax-exempt upload record." },
      { status: 500 },
    );
  }

  try {
    const { data: signed, error: signError } = await admin.storage
      .from(TAX_EXEMPT_CERTIFICATE_BUCKET)
      .createSignedUploadUrl(objectPath, { upsert: true });

    if (signError || !signed?.signedUrl || !signed.token) {
      throw new Error(signError?.message || "Signed upload URL payload was incomplete.");
    }

    return NextResponse.json(
      {
        profileId,
        churchId,
        bucket: TAX_EXEMPT_CERTIFICATE_BUCKET,
        path: objectPath,
        token: signed.token,
        signedUrl: signed.signedUrl,
        mimeType: sanitized.mimeType,
        maxBytes: TAX_EXEMPT_CERTIFICATE_MAX_BYTES,
        verificationStatus: "pending_upload",
      },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" },
      },
    );
  } catch (error) {
    await clearCertificateFields({ profileId, churchId });
    console.error("[tax-exempt.upload] signed URL failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Unable to create signed upload URL." },
      { status: 500 },
    );
  }
}
