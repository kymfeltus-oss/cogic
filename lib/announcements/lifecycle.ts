import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";

/** Promote due scheduled rows and expire past-published rows (service-role). */
export async function syncAnnouncementLifecycle(): Promise<void> {
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  await admin
    .from("announcements")
    .update({
      status: "published",
      published_at: now,
      updated_at: now,
    })
    .eq("status", "scheduled")
    .lte("scheduled_at", now);

  await admin
    .from("announcements")
    .update({
      status: "expired",
      updated_at: now,
    })
    .eq("status", "published")
    .not("expires_at", "is", null)
    .lte("expires_at", now);
}
