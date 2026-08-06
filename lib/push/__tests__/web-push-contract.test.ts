import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  isAllowedPushDeepLink,
  preferenceAllowsAnnouncement,
  preferenceAllowsLive,
} from "@/lib/push/types";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("web push notification contracts", () => {
  it("exposes service worker push handling and safe deep links", () => {
    assert.equal(fs.existsSync(path.join(root, "public/sw.js")), true);
    const sw = read("public/sw.js");
    assert.match(sw, /addEventListener\("push"/);
    assert.match(sw, /notificationclick/);
    assert.match(sw, /\/live/);
    assert.match(sw, /\/updates/);
    assert.doesNotMatch(sw, /WEB_PUSH_VAPID_PRIVATE|privateKey/);

    assert.equal(isAllowedPushDeepLink("/live"), true);
    assert.equal(isAllowedPushDeepLink("/updates"), true);
    assert.equal(isAllowedPushDeepLink("https://evil.example"), false);
    assert.equal(isAllowedPushDeepLink("/../../etc/passwd"), false);
  });

  it("requires intentional user action for permission (no auto-request on load)", () => {
    const prompt = read("components/notifications/StayConnectedPrompt.tsx");
    assert.match(prompt, /Turn on notifications/i);
    assert.match(prompt, /Not now/i);
    assert.match(prompt, /enableDevicePush/);
    assert.doesNotMatch(prompt, /requestPermission\(\)/);
    assert.doesNotMatch(prompt, /useEffect\([\s\S]*requestPermission/);

    const client = read("lib/push/client.ts");
    assert.match(client, /Notification\.requestPermission/);
    assert.match(client, /enableDevicePush/);
  });

  it("persists subscriptions and preferences via authenticated APIs", () => {
    const subscribe = read("app/api/push/subscribe/route.ts");
    const prefs = read("app/api/push/preferences/route.ts");
    assert.match(subscribe, /getUserFromSession/);
    assert.match(subscribe, /push_subscriptions/);
    assert.match(subscribe, /onConflict:\s*"endpoint"/);
    assert.match(subscribe, /export async function DELETE/);
    assert.match(prefs, /upsertNotificationPreferences/);
    assert.match(prefs, /masterEnabled|master_enabled/);
  });

  it("owner mass-send is owner-auth only; attendee cannot mass send", () => {
    const ownerAnn = read("app/api/owner/announcements/route.ts");
    const ownerPatch = read("app/api/owner/announcements/[id]/route.ts");
    const attendeeAnn = read("app/api/announcements/route.ts");
    assert.match(ownerAnn, /requireOwnerUser/);
    assert.match(ownerAnn, /sendPush/);
    assert.match(ownerAnn, /sendAnnouncementPush/);
    assert.match(ownerPatch, /requireOwnerUser/);
    assert.doesNotMatch(attendeeAnn, /sendAnnouncementPush|sendPushCampaign/);
  });

  it("normal publish can omit push; push is explicit", () => {
    const ownerAnn = read("app/api/owner/announcements/route.ts");
    assert.match(ownerAnn, /body\?\.sendPush === true/);
    assert.match(ownerAnn, /status === "published"/);
  });

  it("preferences gate announcement and live delivery", () => {
    const off = { ...DEFAULT_NOTIFICATION_PREFERENCES, masterEnabled: false };
    assert.equal(preferenceAllowsLive(off), false);
    assert.equal(preferenceAllowsAnnouncement(off, "urgent"), false);

    const noAnnouncements = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      announcements: false,
      importantAlerts: false,
    };
    assert.equal(preferenceAllowsAnnouncement(noAnnouncements, "normal"), false);

    const liveOnly = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      liveBroadcasts: false,
    };
    assert.equal(preferenceAllowsLive(liveOnly), false);
    assert.equal(preferenceAllowsLive(DEFAULT_NOTIFICATION_PREFERENCES), true);
  });

  it("LIVE start push fires only from authoritative go-live transition", () => {
    const mutations = read("lib/owner/broadcast-mutations.ts");
    assert.match(mutations, /sendLiveStartPushAlert/);
    assert.match(mutations, /is_live:\s*true/);
    assert.match(mutations, /closeLivePushSession/);
    // Push runs after is_live commit inside runOwnerGoLive, not inside switch-feed probing.
    const goLiveFn = mutations.slice(
      mutations.indexOf("export async function runOwnerGoLive"),
      mutations.indexOf("export async function runOwnerEndBroadcast"),
    );
    assert.match(goLiveFn, /sendLiveStartPushAlert/);
    assert.doesNotMatch(goLiveFn, /probeHlsManifest/);
    const switchFn = mutations.slice(mutations.indexOf("export async function runOwnerSwitchFeed"));
    assert.doesNotMatch(switchFn, /sendLiveStartPushAlert/);

    const goLiveRoute = read("app/api/owner/broadcast/go-live/route.ts");
    assert.match(goLiveRoute, /runOwnerGoLive/);
  });

  it("LIVE alert deduplicates via open session ledger", () => {
    const sql = read("supabase/migrations/20260806190000_web_push_notifications.sql");
    const live = read("lib/push/live-alert.ts");
    assert.match(sql, /live_push_sessions/);
    assert.match(sql, /live_push_sessions_one_open_idx/);
    assert.match(live, /skippedDuplicate/);
    assert.match(live, /ended_at/);
  });

  it("private VAPID key never serialized to clients or public key route", () => {
    const vapid = read("lib/push/vapid.ts");
    const publicRoute = read("app/api/push/vapid-public-key/route.ts");
    const envExample = read(".env.example");
    assert.match(vapid, /server-only/);
    assert.match(vapid, /WEB_PUSH_VAPID_PRIVATE_KEY/);
    assert.match(publicRoute, /getPublicVapidKey/);
    assert.doesNotMatch(publicRoute, /PRIVATE_KEY|privateKey/);
    assert.match(envExample, /WEB_PUSH_VAPID_PUBLIC_KEY=/);
    assert.match(envExample, /WEB_PUSH_VAPID_PRIVATE_KEY=/);
    assert.match(envExample, /SERVER ONLY/);
    assert.doesNotMatch(envExample, /NEXT_PUBLIC_.*VAPID_PRIVATE/);
  });

  it("bell remains in-app unread count, not push sent count", () => {
    const bell = read("components/dashboard/AnnouncementBell.tsx");
    assert.match(bell, /\/api\/announcements\/unread/);
    assert.doesNotMatch(bell, /notification_deliveries|push sent/i);
  });

  it("logout revokes current device subscription ownership", () => {
    const menu = read("components/AwakeningMenuButton.tsx");
    const client = read("lib/push/client.ts");
    assert.match(menu, /revokeCurrentDeviceOnLogout/);
    assert.match(client, /reason:\s*"logout"/);
  });

  it("attendee opt-in and settings UI exist; no mock delivery", () => {
    const shell = read("components/dashboard/DashboardShell.tsx");
    const settings = read("components/notifications/NotificationPreferencesPanel.tsx");
    const profile = read("components/profile/ProfileEditorModal.tsx");
    assert.match(shell, /StayConnectedPrompt/);
    assert.match(settings, /Live Broadcasts/);
    assert.match(settings, /Announcements & Updates/);
    assert.match(profile, /NotificationPreferencesPanel/);
    assert.doesNotMatch(settings, /demo push|fake device|mock notification/i);
  });

  it("owner UI shows real eligible device count and delivery controls", () => {
    const ui = read("components/owner/AnnouncementManagementClient.tsx");
    assert.match(ui, /Device Push/);
    assert.match(ui, /eligiblePushDevices|opted-in devices/);
    assert.match(ui, /sendPush/);
    assert.match(ui, /Resend failed/);
    assert.match(ui, /LIVE auto-alert/);
  });

  it("expired provider responses deactivate subscriptions", () => {
    const deliver = read("lib/push/deliver.ts");
    assert.match(deliver, /statusCode === 404 \|\| statusCode === 410/);
    assert.match(deliver, /deactivateSubscription/);
    assert.match(deliver, /status:\s*"expired"/);
  });

  it("schedule reminders use Vercel Cron batch processing", () => {
    const vercel = read("vercel.json");
    const cron = read("app/api/cron/process-reminders/route.ts");
    assert.match(vercel, /\/api\/cron\/process-reminders/);
    assert.match(cron, /CRON_SECRET/);
    assert.match(cron, /processDueScheduleReminders/);
    assert.match(cron, /Unauthorized/);
  });
});
