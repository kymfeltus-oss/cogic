import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth/session";
import {
  getNotificationPreferences,
  upsertNotificationPreferences,
} from "@/lib/push/preferences";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const preferences = await getNotificationPreferences(user.id);
  const url = new URL(request.url);
  const endpoint = url.searchParams.get("endpoint")?.trim() || "";

  let deviceEnabled = false;
  if (endpoint) {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from("push_subscriptions")
      .select("id, enabled, revoked_at")
      .eq("user_id", user.id)
      .eq("endpoint", endpoint)
      .maybeSingle();
    deviceEnabled = Boolean(data?.enabled && !data.revoked_at);
  }

  const admin = getSupabaseAdmin();
  const { data: devices } = await admin
    .from("push_subscriptions")
    .select("id, enabled, revoked_at, user_agent, last_seen_at, created_at")
    .eq("user_id", user.id)
    .order("last_seen_at", { ascending: false });

  return NextResponse.json(
    {
      preferences,
      deviceEnabled,
      devices: (devices ?? []).map((row) => ({
        id: row.id,
        enabled: row.enabled === true && !row.revoked_at,
        userAgent: row.user_agent,
        lastSeenAt: row.last_seen_at,
        createdAt: row.created_at,
      })),
      scheduleRemindersStatus: "blocked",
      scheduleRemindersNote:
        "Schedule Reminders — BLOCKED BY SCHEDULING INFRASTRUCTURE",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PATCH(request: Request) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Request body is required." }, { status: 400 });
  }

  const preferences = await upsertNotificationPreferences(user.id, {
    masterEnabled:
      typeof body.masterEnabled === "boolean" ? body.masterEnabled : undefined,
    liveBroadcasts:
      typeof body.liveBroadcasts === "boolean" ? body.liveBroadcasts : undefined,
    announcements:
      typeof body.announcements === "boolean" ? body.announcements : undefined,
    importantAlerts:
      typeof body.importantAlerts === "boolean" ? body.importantAlerts : undefined,
    // Persisted for future use, but delivery remains blocked without scheduler.
    scheduleReminders:
      typeof body.scheduleReminders === "boolean" ? body.scheduleReminders : undefined,
  });

  return NextResponse.json(
    {
      preferences,
      scheduleRemindersStatus: "blocked",
      scheduleRemindersNote:
        "Schedule Reminders — BLOCKED BY SCHEDULING INFRASTRUCTURE",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
