import { NextResponse } from "next/server";
import { resendFailedDeliveries } from "@/lib/push/deliver";
import { isWebPushConfigured } from "@/lib/push/vapid";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { requireOwnerUser } from "@/lib/owner/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "Web Push is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { campaignKey?: string } | null;
  const campaignKey =
    typeof body?.campaignKey === "string" ? body.campaignKey.trim() : "";
  if (!campaignKey || campaignKey.length > 200) {
    return NextResponse.json({ error: "campaignKey is required." }, { status: 400 });
  }

  const result = await resendFailedDeliveries(campaignKey);
  return NextResponse.json(
    { ok: true, ...result },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
