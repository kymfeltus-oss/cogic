import { NextResponse } from "next/server";
import { listVisibleAnnouncements } from "@/lib/announcements/published-query";
import { getUserFromSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Attendee-visible published announcements (drafts/scheduled never included). */
export async function GET() {
  try {
    const user = await getUserFromSession();
    const announcements = await listVisibleAnnouncements({
      userId: user?.id ?? null,
      limit: 50,
    });
    return NextResponse.json(
      { announcements },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load announcements." },
      { status: 500 },
    );
  }
}
