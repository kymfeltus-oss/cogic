import { NextResponse } from "next/server";
import { requireOwnerUser } from "@/lib/owner/auth";
import {
  isOwnerAuthed,
  ownerAuthFailureResponse,
  ownerJsonResponse,
} from "@/lib/owner/api-response";
import { executeAmadeusCorporateGroupSearch } from "@/lib/travel/corporate/amadeus-group-caller";
import { getTravelGroupRequestById } from "@/lib/travel/group-booking/repository";

export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POST /api/owner/travel/group-requests/supplier-search
 *
 * Platform-owner Amadeus sandbox/live search for a corporate group request.
 * Body: { requestId } — maps row → IATA payload → flight-offers API.
 * Fail-closed when Amadeus credentials are missing.
 */
export async function POST(request: Request) {
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

  if (!UUID.test(requestId)) {
    return NextResponse.json({ error: "requestId must be a valid UUID." }, { status: 400 });
  }

  try {
    const row = await getTravelGroupRequestById(requestId);
    if (!row) {
      return NextResponse.json({ error: "Group request not found." }, { status: 404 });
    }

    const result = await executeAmadeusCorporateGroupSearch(row);

    if (result.ok === false && "faultCode" in result) {
      return NextResponse.json(
        { error: result.message, faultCode: result.faultCode },
        { status: 503 },
      );
    }

    if (result.ok === false && result.code === "MAPPING_ERROR") {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }

    return ownerJsonResponse({ result });
  } catch (error) {
    console.error("[owner.travel.group-requests.supplier-search] failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Supplier search failed." }, { status: 500 });
  }
}
