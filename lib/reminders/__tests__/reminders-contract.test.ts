import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  computeReminderDueAt,
  isReminderOffsetMinutes,
  reminderOffsetLabel,
} from "@/lib/reminders/types";
import { preferenceAllowsScheduleReminders } from "@/lib/push/types";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("schedule reminder contracts", () => {
  it("computes at-start, 15-minute, and 30-minute due times correctly", () => {
    const start = "2026-11-04T18:00:00.000Z";
    assert.equal(computeReminderDueAt(start, 0), "2026-11-04T18:00:00.000Z");
    assert.equal(computeReminderDueAt(start, 15), "2026-11-04T17:45:00.000Z");
    assert.equal(computeReminderDueAt(start, 30), "2026-11-04T17:30:00.000Z");
    assert.equal(isReminderOffsetMinutes(15), true);
    assert.equal(isReminderOffsetMinutes(10), false);
    assert.equal(reminderOffsetLabel(0), "At start");
  });

  it("exposes authenticated reminder CRUD and owner-only cron", () => {
    const api = read("app/api/reminders/route.ts");
    const cron = read("app/api/cron/process-reminders/route.ts");
    assert.match(api, /getUserFromSession/);
    assert.match(api, /upsertUserReminder/);
    assert.match(api, /cancelUserReminder/);
    assert.match(cron, /CRON_SECRET/);
    assert.doesNotMatch(cron, /getUserFromSession/);
    assert.match(cron, /processDueScheduleReminders/);
  });

  it("attendee Remind Me UI persists through real APIs", () => {
    const ui = read("components/reminders/RemindMeControl.tsx");
    const card = read("components/program/ProgramOccurrenceCard.tsx");
    assert.match(ui, /\/api\/reminders/);
    assert.match(ui, /Remind me/i);
    assert.match(ui, /Cancel reminder/i);
    assert.match(ui, /Change reminder/i);
    assert.match(card, /RemindMeControl/);
    assert.doesNotMatch(ui, /localStorage|setTimeout\(/);
  });

  it("processor cancels unpublished occurrences and is idempotent", () => {
    const process = read("lib/reminders/process.ts");
    assert.match(process, /visibility !== "published"/);
    assert.match(process, /status === "canceled"/);
    assert.match(process, /\.eq\("status", "pending"\)/);
    assert.match(process, /campaignKey = `schedule-reminder:/);
    assert.match(process, /rescheduled/);
  });

  it("disabled schedule preference prevents send", () => {
    assert.equal(
      preferenceAllowsScheduleReminders({
        masterEnabled: true,
        liveBroadcasts: true,
        announcements: true,
        importantAlerts: true,
        scheduleReminders: false,
      }),
      false,
    );
    assert.equal(
      preferenceAllowsScheduleReminders({
        masterEnabled: true,
        liveBroadcasts: true,
        announcements: true,
        importantAlerts: true,
        scheduleReminders: true,
      }),
      true,
    );
  });

  it("migration defines reminder statuses and uniqueness", () => {
    const sql = read("supabase/migrations/20260806200000_schedule_reminders.sql");
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.schedule_reminders/);
    assert.match(sql, /reminder_offset_minutes IN \(0, 15, 30\)/);
    assert.match(sql, /pending[\s\S]*processing[\s\S]*sent[\s\S]*failed[\s\S]*canceled/);
    assert.match(sql, /UNIQUE \(user_id, event_occurrence_id\)/);
  });

  it("owner push status exposes reminder counters without secrets", () => {
    const status = read("app/api/owner/push/status/route.ts");
    assert.match(status, /getReminderOwnerStats/);
    assert.match(status, /pending/);
    assert.doesNotMatch(status, /WEB_PUSH_VAPID_PRIVATE|privateKey|p256dh/);
  });
});
