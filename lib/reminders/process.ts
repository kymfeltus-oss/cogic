import "server-only";

import { sendUserPush } from "@/lib/push/user-push";
import {
  computeReminderDueAt,
  type ReminderOffsetMinutes,
} from "@/lib/reminders/types";
import { loadPublishedOccurrenceStart } from "@/lib/reminders/repository";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const BATCH_LIMIT = 50;

export type ProcessRemindersResult = {
  scanned: number;
  sent: number;
  failed: number;
  canceled: number;
  rescheduled: number;
  skippedDuplicate: number;
};

/**
 * Batch process due schedule reminders. Idempotent — safe for repeated cron ticks.
 */
export async function processDueScheduleReminders(): Promise<ProcessRemindersResult> {
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const result: ProcessRemindersResult = {
    scanned: 0,
    sent: 0,
    failed: 0,
    canceled: 0,
    rescheduled: 0,
    skippedDuplicate: 0,
  };

  const { data: dueRows, error } = await admin
    .from("schedule_reminders")
    .select("*")
    .eq("status", "pending")
    .lte("due_at", now)
    .order("due_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) throw new Error(error.message);
  const rows = dueRows ?? [];
  result.scanned = rows.length;

  for (const row of rows) {
    const reminderId = row.id as string;
    const userId = row.user_id as string;
    const occurrenceId = row.event_occurrence_id as string;
    const offset = row.reminder_offset_minutes as ReminderOffsetMinutes;

    // Claim row (idempotent guard against concurrent cron workers).
    const { data: claimed, error: claimError } = await admin
      .from("schedule_reminders")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", reminderId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (claimError || !claimed) {
      result.skippedDuplicate += 1;
      continue;
    }

    const occurrence = await loadPublishedOccurrenceStart(occurrenceId);
    if (
      !occurrence ||
      occurrence.visibility !== "published" ||
      occurrence.status === "canceled" ||
      occurrence.status === "completed"
    ) {
      await admin
        .from("schedule_reminders")
        .update({
          status: "canceled",
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_error: "Occurrence canceled, unpublished, or unavailable.",
        })
        .eq("id", reminderId);
      result.canceled += 1;
      continue;
    }

    // Reschedule if authoritative start moved and reminder is no longer due.
    const nextDue = computeReminderDueAt(occurrence.scheduledStartAt, offset);
    if (Date.parse(nextDue) > Date.now() + 15_000) {
      await admin
        .from("schedule_reminders")
        .update({
          status: "pending",
          due_at: nextDue,
          updated_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", reminderId);
      result.rescheduled += 1;
      continue;
    }

    const campaignKey = `schedule-reminder:${reminderId}`;
    const minutesCopy =
      offset === 0
        ? "is starting now."
        : `begins in ${offset} minutes.`;

    try {
      const pushResult = await sendUserPush({
        userId,
        campaignKey,
        kind: "schedule_reminder",
        requireSchedulePreference: true,
        payload: {
          title: "COGIC LIVE",
          body: `${occurrence.title} ${minutesCopy} Tap to view details.`,
          url: "/program",
          tag: campaignKey,
          kind: "schedule_reminder",
        },
      });

      if (pushResult.skippedPreference) {
        await admin
          .from("schedule_reminders")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_error: "User disabled schedule reminder preferences.",
          })
          .eq("id", reminderId);
        result.canceled += 1;
        continue;
      }

      if (pushResult.sent > 0 || pushResult.expired > 0) {
        await admin
          .from("schedule_reminders")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_error:
              pushResult.sent === 0
                ? "No active devices; delivery attempts expired."
                : null,
          })
          .eq("id", reminderId);
        result.sent += 1;
      } else {
        await admin
          .from("schedule_reminders")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
            last_error: "No active push devices or all sends failed.",
          })
          .eq("id", reminderId);
        result.failed += 1;
      }
    } catch (sendError) {
      await admin
        .from("schedule_reminders")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
          last_error:
            sendError instanceof Error
              ? sendError.message.slice(0, 400)
              : "Reminder send failed.",
        })
        .eq("id", reminderId);
      result.failed += 1;
    }
  }

  return result;
}
