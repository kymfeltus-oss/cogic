import { NextResponse } from "next/server";
import { getPublicVapidKey, isWebPushConfigured } from "@/lib/push/vapid";

export const dynamic = "force-dynamic";

/** Public VAPID key only — private key is never serialized. */
export async function GET() {
  return NextResponse.json(
    {
      configured: isWebPushConfigured(),
      publicKey: getPublicVapidKey(),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
