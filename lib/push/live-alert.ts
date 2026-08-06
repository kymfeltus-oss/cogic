import "server-only";

import { randomUUID } from "node:crypto";
import { sendPushCampaign, type DeliveryCampaignResult } from "@/lib/push/deliver";
import { isWebPushConfigured } from "@/lib/push/vapid";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Fire ONE automatic live-start push campaign for a real OFFLINE→LIVE transition.
 * Idempotent: only one open live_push_sessions row may exist (partial unique index).
 */
export async function sendLiveStartPushAlert(options: {
  triggeredBy: string;
  serviceTitle?: string | null;
}): Promise<DeliveryCampaignResult | null> {
  if (!isWebPushConfigured()) return null;

  const admin = getSupabaseAdmin();
  const sessionId = randomUUID();
  const campaignKey = `live-start:${sessionId}`;
  const title = "COGIC LIVE IS NOW LIVE";
  const body = options.serviceTitle?.trim()
    ? `${options.serviceTitle.trim()} has started.`
    : "A COGIC LIVE broadcast has started.";

  const { error } = await admin.from("live_push_sessions").insert({
    session_id: sessionId,
    campaign_key: campaignKey,
    triggered_by: options.triggeredBy,
    title: options.serviceTitle ?? null,
    ended_at: null,
  });

  if (error) {
    // Open-session unique index or concurrent insert — already alerted for this live period.
    if (error.code === "23505") {
      return {
        configured: true,
        campaignKey,
        queued: 0,
        sent: 0,
        failed: 0,
        expired: 0,
        skippedDuplicate: true,
      };
    }
    console.error("[push/live-alert] session insert failed:", error.message);
    return null;
  }

  try {
    return await sendPushCampaign({
      campaignKey,
      kind: "live_start",
      createdBy: options.triggeredBy,
      payload: {
        title,
        body: `${body} Tap to watch.`,
        url: "/live",
        tag: campaignKey,
        kind: "live_start",
      },
    });
  } catch (sendError) {
    console.error(
      "[push/live-alert] send failed:",
      sendError instanceof Error ? sendError.message : "unknown",
    );
    return null;
  }
}

/** Close the open live push session so a future legitimate go-live may alert again. */
export async function closeLivePushSession(): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin
    .from("live_push_sessions")
    .update({ ended_at: new Date().toISOString() })
    .is("ended_at", null);
}
