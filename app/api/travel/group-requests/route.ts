import { NextResponse } from "next/server";
import { resolveServerOrgContext } from "@/lib/org/session-org-context";
import {
  createTravelGroupRequest,
  isTravelGroupRequestValidationError,
  listTravelGroupRequestsForChurch,
  sanitizeTravelGroupRequestCreateInput,
} from "@/lib/travel/group-booking/repository";

const LEADERSHIP_ROLES = new Set(["Pastor", "Overseer"]);

/**
 * GET — list group booking requests for the session church.
 * Unauthenticated → 401. Authenticated without church affiliation → truthful [].
 */
export async function GET(request: Request) {
  const context = await resolveServerOrgContext(request);
  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!context.churchId) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const data = await listTravelGroupRequestsForChurch(context.churchId);
    return NextResponse.json(data);
  } catch {
    // Safe production log signature that avoids exposing internal Postgres attributes
    console.error("[travel.group-requests] list failed");
    return NextResponse.json({ error: "Failed to load requests." }, { status: 500 });
  }
}

/**
 * POST — Pastor/Overseer create a corporate group request.
 * church_id, requester_id, and status are stamped server-side only.
 */
export async function POST(request: Request) {
  const context = await resolveServerOrgContext(request);
  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!context.churchId || !LEADERSHIP_ROLES.has(context.role)) {
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

  const sanitized = sanitizeTravelGroupRequestCreateInput(body);
  if (isTravelGroupRequestValidationError(sanitized)) {
    return NextResponse.json({ error: sanitized.error }, { status: sanitized.status });
  }

  try {
    const data = await createTravelGroupRequest({
      churchId: context.churchId,
      requesterId: context.userId,
      ...sanitized,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("[travel.group-requests] create failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Unable to save group booking request." },
      { status: 500 },
    );
  }
}
