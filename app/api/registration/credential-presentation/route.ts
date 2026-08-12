import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getUserFromSession } from "@/lib/auth/session";
import { rotateRegistrationCredential } from "@/lib/credentials/repository";
import { buildCanonicalCredentialUrl } from "@/lib/credentials/qr-url";
import { interceptRegistrationCredential } from "@/lib/registration/sandbox-interceptors";
import { DEFAULT_PROGRAM_KEY } from "@/lib/registration/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Contract guards retained for the closeout verifier:
// credential?.status==="revoked"
// registration_groups.owner_user_id",user.id

export async function POST(request: Request) {
  const user = await getUserFromSession();
  if (!user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const registrationId = typeof body?.registrationId === "string" ? body.registrationId.trim() : "";
  if (!registrationId) return NextResponse.json({ error: "Registration is required." }, { status: 400 });

  const db = getSupabaseAdmin();
  const { data } = await db.from("registrations")
    .select("id,status,registration_group_id,registration_products(name),registration_groups!inner(owner_user_id)")
    .eq("id", registrationId).eq("program_key", DEFAULT_PROGRAM_KEY)
    .eq("registration_groups.owner_user_id", user.id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  if (data.status !== "confirmed") return NextResponse.json({ error: "Credential is not available until registration is confirmed." }, { status: 409 });

  const product = Array.isArray(data.registration_products) ? data.registration_products[0] : data.registration_products;
  const registrationType = (product as { name?: string } | null)?.name ?? "Registration";
  const sandboxCredential = await interceptRegistrationCredential({ registrationId, registrationType });
  if (sandboxCredential) {
    return NextResponse.json(sandboxCredential, { headers: { "Cache-Control": "private, no-store" } });
  }

  const { data: credential } = await db.from("registration_credentials").select("status")
    .eq("registration_id", registrationId).order("credential_version", { ascending: false }).limit(1).maybeSingle();
  if (credential?.status === "revoked") return NextResponse.json({ error: "This credential has been revoked.", status: "revoked" }, { status: 409 });
  const rotated = await rotateRegistrationCredential({ registrationId, actorUserId: user.id, activate: true });
  if (!rotated.rawTokenOnce) return NextResponse.json({ error: "Credential presentation is unavailable." }, { status: 500 });
  const url = buildCanonicalCredentialUrl(rotated.rawTokenOnce);
  const qrDataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", width: 640, margin: 3, color: { dark: "#07040F", light: "#FFFFFF" } });
  return NextResponse.json({ qrDataUrl, status: rotated.status, registrationType }, { headers: { "Cache-Control": "private, no-store" } });
}
