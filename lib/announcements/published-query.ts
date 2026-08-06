import "server-only";

import { mapAnnouncementRow, type AnnouncementRow } from "@/lib/announcements/map";
import { syncAnnouncementLifecycle } from "@/lib/announcements/lifecycle";
import type { Announcement } from "@/lib/announcements/types";
import { DEFAULT_PROGRAM_KEY } from "@/lib/events/types";
import { getRegistrationForUser } from "@/lib/registration/repository";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const SELECT =
  "id, program_key, title, summary, body, category, priority, status, audience, pinned, event_occurrence_id, cta_label, cta_href, scheduled_at, published_at, expires_at, created_at, updated_at";

async function userIsRegisteredAttendee(userId: string): Promise<boolean> {
  try {
    const registration = await getRegistrationForUser({ userId });
    return registration?.status === "confirmed";
  } catch {
    return false;
  }
}

function audienceAllows(
  audience: string,
  options: { userId?: string | null; registered: boolean },
): boolean {
  if (audience === "registered_attendees") {
    return Boolean(options.userId) && options.registered;
  }
  // all_authenticated + program_all require a signed-in attendee for personalization/read state.
  // Anonymous visitors may still view program_all / all_authenticated published notices in-app.
  if (audience === "all_authenticated" || audience === "program_all") {
    return true;
  }
  return false;
}

/** Currently visible published announcements for attendee surfaces. */
export async function listVisibleAnnouncements(options?: {
  userId?: string | null;
  limit?: number;
}): Promise<Announcement[]> {
  await syncAnnouncementLifecycle();

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const limit = options?.limit ?? 50;

  const { data, error } = await admin
    .from("announcements")
    .select(SELECT)
    .eq("program_key", DEFAULT_PROGRAM_KEY)
    .eq("status", "published")
    .or(`published_at.is.null,published_at.lte.${now}`)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as AnnouncementRow[];
  const registered = options?.userId
    ? await userIsRegisteredAttendee(options.userId)
    : false;

  const visible = rows.filter((row) =>
    audienceAllows(row.audience, { userId: options?.userId, registered }),
  );

  let readIds = new Set<string>();

  if (options?.userId && visible.length > 0) {
    const { data: reads } = await admin
      .from("announcement_reads")
      .select("announcement_id")
      .eq("user_id", options.userId)
      .in(
        "announcement_id",
        visible.map((row) => row.id),
      );
    readIds = new Set((reads ?? []).map((row) => row.announcement_id as string));
  }

  return visible.map((row) => mapAnnouncementRow(row, readIds.has(row.id)));
}

export async function countUnreadAnnouncements(userId: string): Promise<number> {
  const items = await listVisibleAnnouncements({ userId, limit: 100 });
  return items.filter((item) => item.read !== true).length;
}

export async function getLatestVisibleAnnouncement(options?: {
  userId?: string | null;
}): Promise<Announcement | null> {
  const items = await listVisibleAnnouncements({ userId: options?.userId, limit: 1 });
  return items[0] ?? null;
}
