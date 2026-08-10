import { NextResponse } from "next/server";
import { listActiveGivingFunds } from "@/lib/giving/repository";

export const dynamic = "force-dynamic";

/** Public active+published giving funds for attendee checkout UIs. */
export async function GET() {
  try {
    const funds = await listActiveGivingFunds();
    return NextResponse.json(
      { funds },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load funds." },
      { status: 503 },
    );
  }
}
