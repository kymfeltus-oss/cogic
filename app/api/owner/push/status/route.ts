import { NextResponse } from "next/server";
import { countEligiblePushDevices } from "@/lib/push/deliver";
import { isWebPushConfigured } from "@/lib/push/vapid";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { requireOwnerUser } from "@/lib/owner/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Owner push status: real eligible device counts + LIVE auto-alert configuration. */
export async function GET() {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const configured = isWebPushConfigured();
  const [announcementDevices, liveDevices] = configured
    ? await Promise.all([
        countEligiblePushDevices({ kind: "announcement", audience: "all_authenticated" }),
        countEligiblePushDevices({ kind: "live_start" }),
      ])
    : [0, 0];

  const admin = getSupabaseAdmin();
  const { data: openSession } = await admin
    .from("live_push_sessions")
    .select("session_id, campaign_key, created_at")
    .is("ended_at", null)
    .maybeSingle();

  return NextResponse.json(
    {
      configured,
      channels: {
        inApp: true,
        devicePush: configured,
        email: false,
        sms: false,
      },
      eligibleDevices: {
        announcements: announcementDevices,
        liveBroadcasts: liveDevices,
      },
      liveAutoAlertEnabled: configured,
      openLivePushSession: openSession
        ? {
            sessionId: openSession.session_id,
            campaignKey: openSession.campaign_key,
            createdAt: openSession.created_at,
          }
        : null,
      nativePush: "NOT_IMPLEMENTED",
      scheduleReminders: "BLOCKED_BY_SCHEDULING_INFRASTRUCTURE",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
