import { NextResponse } from "next/server";
import { listVisibleAnnouncements } from "@/lib/announcements/published-query";
import { getUserFromSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Mark all currently visible announcements as read for the signed-in attendee. */
export async function POST() {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const visible = await listVisibleAnnouncements({ userId: user.id, limit: 100 });
    const unread = visible.filter((item) => item.read !== true);
    if (unread.length === 0) {
      return NextResponse.json(
        { marked: 0 },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const now = new Date().toISOString();
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("announcement_reads").upsert(
      unread.map((item) => ({
        announcement_id: item.id,
        user_id: user.id,
        read_at: now,
      })),
      { onConflict: "announcement_id,user_id" },
    );

    if (error) {
      return NextResponse.json({ error: "Unable to mark all as read." }, { status: 500 });
    }

    return NextResponse.json(
      { marked: unread.length },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to mark all as read." },
      { status: 500 },
    );
  }
}
