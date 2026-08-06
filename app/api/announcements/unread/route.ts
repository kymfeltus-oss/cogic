import { NextResponse } from "next/server";
import {
  countUnreadAnnouncements,
  getLatestVisibleAnnouncement,
} from "@/lib/announcements/published-query";
import { getUserFromSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Real unread count for authenticated attendees only. */
export async function GET() {
  try {
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json(
        { unreadCount: 0, latest: null, authenticated: false },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const [unreadCount, latest] = await Promise.all([
      countUnreadAnnouncements(user.id),
      getLatestVisibleAnnouncement({ userId: user.id }),
    ]);

    return NextResponse.json(
      {
        unreadCount,
        latest: latest
          ? {
              id: latest.id,
              title: latest.title,
              publishedAt: latest.publishedAt,
              priority: latest.priority,
            }
          : null,
        authenticated: true,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load unread state." },
      { status: 500 },
    );
  }
}
