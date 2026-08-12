import { NextResponse } from "next/server";

import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { requireOwnerUser } from "@/lib/owner/auth";
import { executeRegistrationOwnerRefund } from "@/lib/registration/admin-refund";
import { registrationHttpStatus, toSafeRegistrationMessage } from "@/lib/registration/errors";

export const dynamic = "force-dynamic";

/**
 * Owner Stripe refund saga.
 * Amount is claimed from the locked paid payment row — never from the client body.
 */
export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) {
    return ownerAuthFailureResponse(auth);
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const registrationId = String(body?.registrationId ?? "").trim();
  const reason = String(body?.reason ?? "").trim();
  const idempotencyKey =
    typeof body?.idempotencyKey === "string" ? body.idempotencyKey.trim() : null;

  if (!registrationId) {
    return NextResponse.json({ error: "registrationId is required." }, { status: 400 });
  }
  if (reason.length < 8) {
    return NextResponse.json(
      { error: "A refund reason of at least 8 characters is required." },
      { status: 400 },
    );
  }

  // Fail closed if an administrative client attempts to inject an amount.
  if (
    body &&
    ("amountCents" in body ||
      "amount_cents" in body ||
      "totalCents" in body ||
      "total_cents" in body ||
      "requestedAmountCents" in body)
  ) {
    return NextResponse.json(
      { error: "Client-supplied refund amounts are rejected. Amount is server-authoritative." },
      { status: 400 },
    );
  }

  try {
    const result = await executeRegistrationOwnerRefund({
      registrationId,
      actorUserId: auth.userId,
      reason,
      idempotencyKey,
    });
    return NextResponse.json(
      { ok: true, refund: result },
      { status: result.idempotent ? 200 : 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: toSafeRegistrationMessage(error) },
      { status: registrationHttpStatus(error) },
    );
  }
}
