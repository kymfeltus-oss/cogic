export const PUSH_DEEP_LINKS = ["/live", "/updates", "/program", "/replays"] as const;

export type NotificationPreferences = {
  masterEnabled: boolean;
  liveBroadcasts: boolean;
  announcements: boolean;
  importantAlerts: boolean;
  scheduleReminders: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  masterEnabled: true,
  liveBroadcasts: true,
  announcements: true,
  importantAlerts: true,
  scheduleReminders: false,
};

export type PushSubscriptionRecord = {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  enabled: boolean;
  label: string | null;
  userAgent: string | null;
  lastSeenAt: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  kind: "announcement" | "live_start" | "schedule_reminder";
};

export function isAllowedPushDeepLink(value: string): boolean {
  if ((PUSH_DEEP_LINKS as readonly string[]).includes(value)) return true;
  if (value.startsWith("/replays/") && value.length < 120 && !value.includes("..")) {
    return true;
  }
  return false;
}

export function preferenceAllowsAnnouncement(
  prefs: NotificationPreferences,
  priority: string,
): boolean {
  if (!prefs.masterEnabled) return false;
  if (priority === "urgent" || priority === "important") {
    return prefs.importantAlerts || prefs.announcements;
  }
  return prefs.announcements;
}

export function preferenceAllowsLive(prefs: NotificationPreferences): boolean {
  return prefs.masterEnabled && prefs.liveBroadcasts;
}

export function preferenceAllowsScheduleReminders(
  prefs: NotificationPreferences,
): boolean {
  return prefs.masterEnabled && prefs.scheduleReminders;
}
