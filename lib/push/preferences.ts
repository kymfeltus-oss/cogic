import "server-only";

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "@/lib/push/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export {
  preferenceAllowsAnnouncement,
  preferenceAllowsLive,
} from "@/lib/push/types";

type PrefRow = {
  master_enabled: boolean;
  live_broadcasts: boolean;
  announcements: boolean;
  important_alerts: boolean;
  schedule_reminders: boolean;
};

function mapPrefs(row: PrefRow | null): NotificationPreferences {
  if (!row) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  return {
    masterEnabled: row.master_enabled !== false,
    liveBroadcasts: row.live_broadcasts !== false,
    announcements: row.announcements !== false,
    importantAlerts: row.important_alerts !== false,
    scheduleReminders: row.schedule_reminders === true,
  };
}

export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("notification_preferences")
    .select(
      "master_enabled, live_broadcasts, announcements, important_alerts, schedule_reminders",
    )
    .eq("user_id", userId)
    .maybeSingle();
  return mapPrefs((data as PrefRow | null) ?? null);
}

export async function upsertNotificationPreferences(
  userId: string,
  patch: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(userId);
  const next: NotificationPreferences = {
    masterEnabled: patch.masterEnabled ?? current.masterEnabled,
    liveBroadcasts: patch.liveBroadcasts ?? current.liveBroadcasts,
    announcements: patch.announcements ?? current.announcements,
    importantAlerts: patch.importantAlerts ?? current.importantAlerts,
    scheduleReminders: patch.scheduleReminders ?? current.scheduleReminders,
  };

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("notification_preferences").upsert(
    {
      user_id: userId,
      master_enabled: next.masterEnabled,
      live_broadcasts: next.liveBroadcasts,
      announcements: next.announcements,
      important_alerts: next.importantAlerts,
      schedule_reminders: next.scheduleReminders,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  return next;
}
