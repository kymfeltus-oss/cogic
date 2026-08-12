import { NextResponse } from "next/server";

import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { requireOwnerUser } from "@/lib/owner/auth";
import { correctRegistrationAttendee } from "@/lib/registration/admin-correct";
import { registrationHttpStatus, toSafeRegistrationMessage } from "@/lib/registration/errors";

export const dynamic = "force-dynamic";

/**
 * Audited attendee profile correction.
 * Allowlisted fields only — pricing/status/group structure rejected.
 */
export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) {
    return ownerAuthFailureResponse(auth);
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const registrationId = String(body?.registrationId ?? "").trim();
  const reason = String(body?.reason ?? "").trim();
  const expectedRegistrationVersion =
    typeof body?.expectedRegistrationVersion === "number"
      ? body.expectedRegistrationVersion
      : null;

  if (!registrationId) {
    return NextResponse.json({ error: "registrationId is required." }, { status: 400 });
  }
  if (reason.length < 8) {
    return NextResponse.json(
      { error: "A correction audit reason of at least 8 characters is required." },
      { status: 400 },
    );
  }

  try {
    const result = await correctRegistrationAttendee({
      registrationId,
      actorUserId: auth.userId,
      corrections: body?.corrections,
      reason,
      expectedRegistrationVersion,
    });
    return NextResponse.json(
      { ok: true, registration: result },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: toSafeRegistrationMessage(error) },
      { status: registrationHttpStatus(error) },
    );
  }
}
