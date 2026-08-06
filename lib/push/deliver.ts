import "server-only";

import webpush from "web-push";
import { getNotificationPreferences } from "@/lib/push/preferences";
import {
  isAllowedPushDeepLink,
  preferenceAllowsAnnouncement,
  preferenceAllowsLive,
  type PushPayload,
} from "@/lib/push/types";
import { getVapidConfig, isWebPushConfigured } from "@/lib/push/vapid";
import { getRegistrationForUser } from "@/lib/registration/repository";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const BATCH_SIZE = 40;

type ActiveSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type DeliveryCampaignResult = {
  configured: boolean;
  campaignKey: string;
  queued: number;
  sent: number;
  failed: number;
  expired: number;
  skippedDuplicate: boolean;
};

function configureWebPush() {
  const vapid = getVapidConfig();
  if (!vapid) return null;
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  return vapid;
}

async function userMatchesAudience(
  userId: string,
  audience: string,
): Promise<boolean> {
  if (audience === "registered_attendees") {
    try {
      const registration = await getRegistrationForUser({ userId });
      return registration?.status === "confirmed";
    } catch {
      return false;
    }
  }
  return audience === "all_authenticated" || audience === "program_all";
}

export async function countEligiblePushDevices(options: {
  kind: "announcement" | "live_start";
  audience?: string;
  priority?: string;
}): Promise<number> {
  if (!isWebPushConfigured()) return 0;
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("push_subscriptions")
    .select("id, user_id")
    .eq("enabled", true)
    .is("revoked_at", null)
    .eq("channel", "web_push");

  const rows = (data ?? []) as Array<{ id: string; user_id: string }>;
  let count = 0;
  for (const row of rows) {
    const prefs = await getNotificationPreferences(row.user_id);
    if (options.kind === "live_start") {
      if (!preferenceAllowsLive(prefs)) continue;
    } else {
      if (!preferenceAllowsAnnouncement(prefs, options.priority ?? "normal")) continue;
      if (
        options.audience &&
        !(await userMatchesAudience(row.user_id, options.audience))
      ) {
        continue;
      }
    }
    count += 1;
  }
  return count;
}

async function loadEligibleSubscriptions(options: {
  kind: "announcement" | "live_start";
  audience?: string;
  priority?: string;
}): Promise<ActiveSubscription[]> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .eq("enabled", true)
    .is("revoked_at", null)
    .eq("channel", "web_push");

  const rows = (data ?? []) as ActiveSubscription[];
  const eligible: ActiveSubscription[] = [];

  for (const row of rows) {
    const prefs = await getNotificationPreferences(row.user_id);
    if (options.kind === "live_start") {
      if (!preferenceAllowsLive(prefs)) continue;
    } else {
      if (!preferenceAllowsAnnouncement(prefs, options.priority ?? "normal")) continue;
      if (
        options.audience &&
        !(await userMatchesAudience(row.user_id, options.audience))
      ) {
        continue;
      }
    }
    eligible.push(row);
  }
  return eligible;
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

export async function sendPushCampaign(options: {
  campaignKey: string;
  kind: "announcement" | "live_start";
  payload: PushPayload;
  audience?: string;
  priority?: string;
  announcementId?: string | null;
  createdBy?: string | null;
}): Promise<DeliveryCampaignResult> {
  const empty: DeliveryCampaignResult = {
    configured: false,
    campaignKey: options.campaignKey,
    queued: 0,
    sent: 0,
    failed: 0,
    expired: 0,
    skippedDuplicate: false,
  };

  if (!configureWebPush()) return empty;
  if (!isAllowedPushDeepLink(options.payload.url)) {
    throw new Error("Push deep link is not an approved internal route.");
  }

  const admin = getSupabaseAdmin();

  // Campaign-level dedupe: if any delivery already exists for this campaign, skip.
  const { data: existing } = await admin
    .from("notification_deliveries")
    .select("id")
    .eq("campaign_key", options.campaignKey)
    .limit(1);
  if (existing && existing.length > 0) {
    return { ...empty, configured: true, skippedDuplicate: true };
  }

  const subscriptions = await loadEligibleSubscriptions({
    kind: options.kind,
    audience: options.audience,
    priority: options.priority,
  });

  if (subscriptions.length === 0) {
    return { ...empty, configured: true };
  }

  const now = new Date().toISOString();
  const rows = subscriptions.map((sub) => ({
    campaign_key: options.campaignKey,
    idempotency_key: `${options.campaignKey}:${sub.id}`,
    kind: options.kind,
    announcement_id: options.announcementId ?? null,
    subscription_id: sub.id,
    user_id: sub.user_id,
    status: "queued",
    title: options.payload.title,
    body: options.payload.body,
    deep_link: options.payload.url,
    created_by: options.createdBy ?? null,
    created_at: now,
    updated_at: now,
  }));

  const { error: insertError } = await admin.from("notification_deliveries").insert(rows);
  if (insertError) {
    // Unique violation = concurrent duplicate campaign
    if (insertError.code === "23505") {
      return { ...empty, configured: true, skippedDuplicate: true };
    }
    throw new Error(insertError.message);
  }

  let sent = 0;
  let failed = 0;
  let expired = 0;
  const jsonPayload = JSON.stringify({
    title: options.payload.title,
    body: options.payload.body,
    url: options.payload.url,
    tag: options.payload.tag ?? options.campaignKey,
    kind: options.payload.kind,
  });

  for (let i = 0; i < subscriptions.length; i += BATCH_SIZE) {
    const batch = subscriptions.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (sub) => {
        const idempotencyKey = `${options.campaignKey}:${sub.id}`;
        await admin
          .from("notification_deliveries")
          .update({ status: "processing", updated_at: new Date().toISOString() })
          .eq("idempotency_key", idempotencyKey);

        try {
          const result = await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            jsonPayload,
            { TTL: 60 * 60 * 6 },
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
            await deactivateSubscription(sub.id, `provider_${statusCode}`);
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
      }),
    );
  }

  return {
    configured: true,
    campaignKey: options.campaignKey,
    queued: subscriptions.length,
    sent,
    failed,
    expired,
    skippedDuplicate: false,
  };
}

export async function resendFailedDeliveries(campaignKey: string): Promise<{
  resent: number;
  failed: number;
  expired: number;
}> {
  if (!configureWebPush()) {
    return { resent: 0, failed: 0, expired: 0 };
  }

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("notification_deliveries")
    .select(
      "id, idempotency_key, subscription_id, title, body, deep_link, kind, status",
    )
    .eq("campaign_key", campaignKey)
    .eq("status", "failed");

  const rows = data ?? [];
  let resent = 0;
  let failed = 0;
  let expired = 0;

  for (const row of rows) {
    if (!row.subscription_id) {
      failed += 1;
      continue;
    }
    const { data: sub } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, enabled, revoked_at")
      .eq("id", row.subscription_id)
      .maybeSingle();
    if (!sub || !sub.enabled || sub.revoked_at) {
      failed += 1;
      continue;
    }

    try {
      const result = await webpush.sendNotification(
        {
          endpoint: sub.endpoint as string,
          keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
        },
        JSON.stringify({
          title: row.title,
          body: row.body,
          url: row.deep_link,
          tag: campaignKey,
          kind: row.kind,
        }),
      );
      await admin
        .from("notification_deliveries")
        .update({
          status: "sent",
          provider_status_code: result.statusCode,
          error_message: null,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      resent += 1;
    } catch (error) {
      const statusCode =
        typeof error === "object" &&
        error &&
        "statusCode" in error &&
        typeof (error as { statusCode?: unknown }).statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : null;
      if (statusCode === 404 || statusCode === 410) {
        await deactivateSubscription(sub.id as string, `provider_${statusCode}`);
        await admin
          .from("notification_deliveries")
          .update({
            status: "expired",
            provider_status_code: statusCode,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        expired += 1;
      } else {
        failed += 1;
      }
    }
  }

  return { resent, failed, expired };
}
