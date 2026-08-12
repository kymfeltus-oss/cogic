import { NextResponse } from "next/server";
import { applySupplierWebhookEvent } from "@/lib/travel/ops/supplier-webhook";
import {
  decryptSupplierWebhookPayload,
  normalizeSupplierWebhookPayload,
  verifySupplierWebhookSignature,
} from "@/lib/travel/ops/supplier-webhook-parse";

export const dynamic = "force-dynamic";

/**
 * Production supplier webhook intake.
 * 1) HMAC-verify raw body with TRAVEL_SUPPLIER_WEBHOOK_SECRET
 * 2) Optionally decrypt AES-256-GCM envelope
 * 3) Normalize Expedia Rapid / Duffel payloads
 * 4) Apply booking updates + travel_booking_transaction_events + My Trip supplier events
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature =
    request.headers.get("x-cogic-travel-signature") ||
    request.headers.get("x-duffel-signature") ||
    request.headers.get("x-expedia-signature");

  const verified = verifySupplierWebhookSignature(rawBody, signature);
  if (verified.ok === false) {
    return NextResponse.json({ error: verified.reason }, { status: 401 });
  }

  const decrypted = decryptSupplierWebhookPayload(rawBody);
  if (decrypted.ok === false) {
    return NextResponse.json({ error: decrypted.reason }, { status: 400 });
  }

  let body: unknown = null;
  try {
    body = JSON.parse(decrypted.plaintext);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body after decryption." }, { status: 400 });
  }

  const normalized = normalizeSupplierWebhookPayload(body);
  if (!normalized) {
    return NextResponse.json(
      { error: "Unrecognized supplier webhook payload." },
      { status: 400 },
    );
  }

  try {
    const result = await applySupplierWebhookEvent(normalized);
    return NextResponse.json({
      ok: true,
      applied: result.applied,
      attemptId: result.attemptId,
      userId: result.userId,
      eventId: result.eventId,
    });
  } catch (error) {
    console.error("supplier webhook apply failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to apply supplier event." },
      { status: 500 },
    );
  }
}
