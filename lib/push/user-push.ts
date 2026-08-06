import "server-only";

import webpush from "web-push";
import {
  getNotificationPreferences,
} from "@/lib/push/preferences";
import {
  isAllowedPushDeepLink,
  preferenceAllowsScheduleReminders,
  type PushPayload,
} from "@/lib/push/types";
import { getVapidConfig } from "@/lib/push/vapid";
import { getSupabaseAdmin } from "@/lib/supabase/server";

function configureWebPush() {
  const vapid = getVapidConfig();
  if (!vapid) return null;
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  return vapid;
}

async function deactivateSubscription(subscriptionId: string, reason: string) {
  const admin = getSupabaseAdmin();
  await admin
    .from("push_subscriptions")
    .update({
      enabled: false,
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      label: reason.slice(0, 120),
    })
    .eq("id", subscriptionId);
}

/** Send a push to all active devices for one authenticated user. */
export async function sendUserPush(options: {
  userId: string;
  campaignKey: string;
  kind: "schedule_reminder";
  payload: PushPayload;
  requireSchedulePreference?: boolean;
}): Promise<{
  sent: number;
  failed: number;
  expired: number;
  skippedPreference: boolean;
}> {
  if (!configureWebPush()) {
    return { sent: 0, failed: 0, expired: 0, skippedPreference: false };
  }
  if (!isAllowedPushDeepLink(options.payload.url)) {
    throw new Error("Push deep link is not an approved internal route.");
  }

  const prefs = await getNotificationPreferences(options.userId);
  if (
    options.requireSchedulePreference !== false &&
    !preferenceAllowsScheduleReminders(prefs)
  ) {
    return { sent: 0, failed: 0, expired: 0, skippedPreference: true };
  }

  const admin = getSupabaseAdmin();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", options.userId)
    .eq("enabled", true)
    .is("revoked_at", null)
    .eq("channel", "web_push");

  const subscriptions = subs ?? [];
  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, expired: 0, skippedPreference: false };
  }

  const now = new Date().toISOString();
  const jsonPayload = JSON.stringify({
    title: options.payload.title,
    body: options.payload.body,
    url: options.payload.url,
    tag: options.payload.tag ?? options.campaignKey,
    kind: options.payload.kind,
  });

  let sent = 0;
  let failed = 0;
  let expired = 0;

  for (const sub of subscriptions) {
    const idempotencyKey = `${options.campaignKey}:${sub.id}`;
    const { error: insertError } = await admin.from("notification_deliveries").insert({
      campaign_key: options.campaignKey,
      idempotency_key: idempotencyKey,
      kind: options.kind,
      subscription_id: sub.id,
      user_id: options.userId,
      status: "processing",
      title: options.payload.title,
      body: options.payload.body,
      deep_link: options.payload.url,
      created_at: now,
      updated_at: now,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        // Already delivered for this device/campaign.
        continue;
      }
      failed += 1;
      continue;
    }

    try {
      const result = await webpush.sendNotification(
        {
          endpoint: sub.endpoint as string,
          keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
        },
        jsonPayload,
        { TTL: 60 * 60 },
      );
      await admin
        .from("notification_deliveries")
        .update({
          status: "sent",
          provider_status_code: result.statusCode,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("idempotency_key", idempotencyKey);
      sent += 1;
    } catch (error) {
      const statusCode =
        typeof error === "object" &&
        error &&
        "statusCode" in error &&
        typeof (error as { statusCode?: unknown }).statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : null;
      const message = error instanceof Error ? error.message : "Push send failed.";
      if (statusCode === 404 || statusCode === 410) {
        await deactivateSubscription(sub.id as string, `provider_${statusCode}`);
        await admin
          .from("notification_deliveries")
          .update({
            status: "expired",
            provider_status_code: statusCode,
            error_message: message.slice(0, 400),
            updated_at: new Date().toISOString(),
          })
          .eq("idempotency_key", idempotencyKey);
        expired += 1;
      } else {
        await admin
          .from("notification_deliveries")
          .update({
            status: "failed",
            provider_status_code: statusCode,
            error_message: message.slice(0, 400),
            updated_at: new Date().toISOString(),
          })
          .eq("idempotency_key", idempotencyKey);
        failed += 1;
      }
    }
  }

  return { sent, failed, expired, skippedPreference: false };
}
