import { NextResponse } from "next/server";
import { requireOwnerUser } from "@/lib/owner/auth";
import {
  isOwnerAuthed,
  ownerAuthFailureResponse,
  ownerJsonResponse,
} from "@/lib/owner/api-response";
import {
  listAllTravelGroupRequests,
  TRAVEL_GROUP_REQUEST_STATUSES,
  updateTravelGroupRequestStatus,
  type TravelGroupRequestStatus,
} from "@/lib/travel/group-booking/repository";

function parseAllocatedQuoteCents(source: Record<string, unknown>): {
  ok: true;
  provided: boolean;
  value: number | null;
} | { ok: false; error: string } {
  if (!("allocated_quote_cents" in source) && !("allocatedQuoteCents" in source)) {
    return { ok: true, provided: false, value: null };
  }

  const raw = source.allocated_quote_cents ?? source.allocatedQuoteCents;
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, provided: true, value: null };
  }

  const cents = Number(raw);
  if (!Number.isInteger(cents) || cents < 0) {
    return {
      ok: false,
      error: "allocated_quote_cents must be a non-negative integer (USD cents).",
    };
  }

  return { ok: true, provided: true, value: cents };
}

export async function GET(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const limitRaw = new URL(request.url).searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 100;

  try {
    const rows = await listAllTravelGroupRequests(limit);
    return ownerJsonResponse({ requests: rows });
  } catch (error) {
    console.error("[owner.travel.group-requests] list failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to load group requests." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const source = body as Record<string, unknown>;
  const requestId = String(source.requestId ?? source.request_id ?? "").trim();
  const status = String(source.status ?? "").trim() as TravelGroupRequestStatus;
  const notesRaw = source.ownerNotes ?? source.owner_notes;
  const ownerNotes =
    typeof notesRaw === "string" && notesRaw.trim()
      ? notesRaw.trim().slice(0, 2000)
      : null;

  if (!requestId) {
    return NextResponse.json({ error: "requestId is required." }, { status: 400 });
  }
  if (!(TRAVEL_GROUP_REQUEST_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const quote = parseAllocatedQuoteCents(source);
  if (quote.ok === false) {
    return NextResponse.json({ error: quote.error }, { status: 400 });
  }

  if (
    (status === "quoted" || status === "approved") &&
    !(quote.provided && quote.value && quote.value > 0)
  ) {
    return NextResponse.json(
      { error: "quoted/approved status requires allocated_quote_cents greater than 0." },
      { status: 400 },
    );
  }

  try {
    const row = await updateTravelGroupRequestStatus({
      requestId,
      status,
      ownerNotes,
      ...(quote.provided ? { allocatedQuoteCents: quote.value } : {}),
    });
    return ownerJsonResponse({ request: row });
  } catch (error) {
    console.error("[owner.travel.group-requests] update failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Unable to update group request." }, { status: 500 });
  }
}
