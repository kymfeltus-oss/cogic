import { NextResponse } from "next/server";
import { resolveServerOrgContext } from "@/lib/org/session-org-context";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { TAX_EXEMPT_CERTIFICATE_BUCKET } from "@/lib/travel/corporate/tax-exempt";

export const dynamic = "force-dynamic";

const LEADERSHIP_ROLES = new Set(["Pastor", "Overseer"]);

type TaxProfileConfirmRow = {
  id: string;
  church_id: string;
  verification_status: string;
  certificate_object_path: string | null;
  certificate_bucket: string | null;
};

/**
 * POST /api/travel/corporate/tax-exempt/confirm
 *
 * After the client uploads bytes to the signed URL, verify the object exists in
 * private storage and advance church_tax_profiles to pending_review.
 */
export async function POST(request: Request) {
  const context = await resolveServerOrgContext(request);
  if (!context || !context.churchId || !LEADERSHIP_ROLES.has(context.role)) {
    return NextResponse.json(
      { error: "Pastor or Overseer membership is required." },
      { status: 403 },
    );
  }

  const churchId = context.churchId;
  const admin = getSupabaseAdmin();

  const { data: profile, error: lookupError } = await admin
    .from("church_tax_profiles")
    .select("id,church_id,verification_status,certificate_object_path,certificate_bucket")
    .eq("church_id", churchId)
    .maybeSingle();

  if (lookupError) {
    console.error("[tax-exempt.confirm] profile lookup failed", {
      message: lookupError.message,
      code: lookupError.code,
    });
    return NextResponse.json({ error: "Unable to load tax profile." }, { status: 500 });
  }

  const row = profile as TaxProfileConfirmRow | null;
  if (!row || row.verification_status !== "pending_upload") {
    return NextResponse.json(
      {
        error:
          "Tax-exempt profile must exist in pending_upload before confirmation.",
      },
      { status: 409 },
    );
  }

  const objectPath = row.certificate_object_path?.trim() || "";
  if (!objectPath) {
    return NextResponse.json(
      { error: "Tax-exempt profile is missing a certificate object path." },
      { status: 409 },
    );
  }

  const expectedPrefix = `${churchId}/${row.id}`;
  if (!objectPath.startsWith(`${expectedPrefix}/`)) {
    return NextResponse.json(
      { error: "Certificate object path does not match this church profile." },
      { status: 409 },
    );
  }

  const fileName = objectPath.slice(objectPath.lastIndexOf("/") + 1);
  const directoryPath = expectedPrefix;

  const { data: listed, error: listError } = await admin.storage
    .from(TAX_EXEMPT_CERTIFICATE_BUCKET)
    .list(directoryPath, {
      search: fileName,
      limit: 20,
    });

  if (listError) {
    console.error("[tax-exempt.confirm] storage list failed", {
      message: listError.message,
    });
    return NextResponse.json(
      { error: "Unable to verify uploaded certificate in storage." },
      { status: 500 },
    );
  }

  const found = (listed ?? []).some(
    (entry) => String(entry?.name || "").trim() === fileName,
  );

  if (!listed || listed.length === 0 || !found) {
    return NextResponse.json(
      { error: "Uploaded certificate was not found in storage." },
      { status: 404 },
    );
  }

  const uploadedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await admin
    .from("church_tax_profiles")
    .update({
      verification_status: "pending_review",
      uploaded_by: context.userId,
      uploaded_at: uploadedAt,
      certificate_bucket: TAX_EXEMPT_CERTIFICATE_BUCKET,
    })
    .eq("id", row.id)
    .eq("church_id", churchId)
    .eq("verification_status", "pending_upload")
    .select("*")
    .single();

  if (updateError || !updated) {
    console.error("[tax-exempt.confirm] status update failed", {
      message: updateError?.message ?? "missing updated row",
    });
    return NextResponse.json(
      { error: "Unable to advance tax-exempt profile to pending_review." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { profile: updated },
    {
      status: 200,
      headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" },
    },
  );
}
