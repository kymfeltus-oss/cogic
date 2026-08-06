import { NextResponse } from "next/server";

import { getLiveness, getReadiness } from "@/lib/health/readiness";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Production health:
 * - GET /api/health → readiness booleans (no secret values)
 * - GET /api/health?live=1 → liveness only
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const liveOnly = url.searchParams.get("live") === "1";

  if (liveOnly) {
    return NextResponse.json(getLiveness(), {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const readiness = getReadiness();
  return NextResponse.json(readiness, {
    status: readiness.status === "ready" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
