import "server-only";

import {
  computeReminderDueAt,
  isReminderOffsetMinutes,
  type ReminderOffsetMinutes,
  type ScheduleReminder,
} from "@/lib/reminders/types";
import { DEFAULT_PROGRAM_KEY } from "@/lib/events/types";
import { upsertNotificationPreferences } from "@/lib/push/preferences";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type ReminderRow = {
  id: string;
  user_id: string;
  event_occurrence_id: string;
  reminder_offset_minutes: number;
  due_at: string;
  status: string;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  canceled_at: string | null;
};

function mapRow(row: ReminderRow): ScheduleReminder {
  return {
    id: row.id,
    userId: row.user_id,
    eventOccurrenceId: row.event_occurrence_id,
    reminderOffsetMinutes: row.reminder_offset_minutes as ReminderOffsetMinutes,
    dueAt: row.due_at,
    status: row.status as ScheduleReminder["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentAt: row.sent_at,
    canceledAt: row.canceled_at,
  };
}

async function loadPublishedOccurrenceStart(occurrenceId: string): Promise<{
  id: string;
  title: string;
  scheduledStartAt: string;
  status: string;
  visibility: string;
} | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("event_occurrences")
    .select(
      "id, status, visibility, scheduled_start_at, title_override, events!inner(title, status, program_key)",
    )
    .eq("id", occurrenceId)
    .eq("events.program_key", DEFAULT_PROGRAM_KEY)
    .maybeSingle();

  if (error || !data) return null;

  const events = data.events as
    | { title?: string; status?: string; program_key?: string }
    | { title?: string; status?: string; program_key?: string }[]
    | null;
  const parent = Array.isArray(events) ? events[0] : events;
  const start =
    typeof data.scheduled_start_at === "string" ? data.scheduled_start_at : null;
  if (!start) return null;

  const title =
    (typeof data.title_override === "string" && data.title_override.trim()) ||
    (typeof parent?.title === "string" ? parent.title : "COGIC LIVE event");

  return {
    id: data.id as string,
    title,
    scheduledStartAt: start,
    status: data.status as string,
    visibility: data.visibility as string,
  };
}

export async function listUserReminders(userId: string): Promise<ScheduleReminder[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("schedule_reminders")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["pending", "processing", "sent"])
    .order("due_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ReminderRow[]).map(mapRow);
}

export async function upsertUserReminder(input: {
  userId: string;
  occurrenceId: string;
  offsetMinutes: ReminderOffsetMinutes;
}): Promise<ScheduleReminder> {
  if (!isReminderOffsetMinutes(input.offsetMinutes)) {
    throw new Error("Invalid reminder offset.");
  }

  const occurrence = await loadPublishedOccurrenceStart(input.occurrenceId);
  if (!occurrence) {
    throw new Error("Occurrence not found.");
  }
  if (occurrence.visibility !== "published" || occurrence.status === "canceled") {
    throw new Error("Reminders are only available for published, active occurrences.");
  }

  const dueAt = computeReminderDueAt(occurrence.scheduledStartAt, input.offsetMinutes);
  if (Date.parse(dueAt) <= Date.now()) {
    throw new Error("That reminder time has already passed.");
  }

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("schedule_reminders")
    .select("id, status")
    .eq("user_id", input.userId)
    .eq("event_occurrence_id", input.occurrenceId)
    .maybeSingle();
  if (
    existing &&
    (existing.status === "sent" || existing.status === "processing")
  ) {
    throw new Error("A reminder was already delivered for this event.");
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("schedule_reminders")
    .upsert(
      {
        user_id: input.userId,
        event_occurrence_id: input.occurrenceId,
        reminder_offset_minutes: input.offsetMinutes,
        due_at: dueAt,
        status: "pending",
        sent_at: null,
        canceled_at: null,
        last_error: null,
        updated_at: now,
      },
      { onConflict: "user_id,event_occurrence_id" },
    )
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message || "Unable to save reminder.");

  // Persist preference so the reminder can actually deliver.
  await upsertNotificationPreferences(input.userId, {
    masterEnabled: true,
    scheduleReminders: true,
  });

  return mapRow(data as ReminderRow);
}

/** Recalculate pending due_at values when an occurrence start time changes. */
export async function syncPendingRemindersForOccurrence(input: {
  occurrenceId: string;
  scheduledStartAt: string | null;
  visibility: string;
  status: string;
}): Promise<number> {
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  if (
    !input.scheduledStartAt ||
    input.visibility !== "published" ||
    input.status === "canceled" ||
    input.status === "completed"
  ) {
    const { data } = await admin
      .from("schedule_reminders")
      .update({
        status: "canceled",
        canceled_at: now,
        updated_at: now,
        last_error: "Occurrence canceled, unpublished, or unavailable.",
      })
      .eq("event_occurrence_id", input.occurrenceId)
      .eq("status", "pending")
      .select("id");
    return (data ?? []).length;
  }

  const { data: pending, error } = await admin
    .from("schedule_reminders")
    .select("id, reminder_offset_minutes")
    .eq("event_occurrence_id", input.occurrenceId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);

  let updated = 0;
  for (const row of pending ?? []) {
    const offset = row.reminder_offset_minutes as ReminderOffsetMinutes;
    if (!isReminderOffsetMinutes(offset)) continue;
    const dueAt = computeReminderDueAt(input.scheduledStartAt, offset);
    const { error: updateError } = await admin
      .from("schedule_reminders")
      .update({ due_at: dueAt, updated_at: now, last_error: null })
      .eq("id", row.id)
      .eq("status", "pending");
    if (!updateError) updated += 1;
  }
  return updated;
}

export async function cancelUserReminder(input: {
  userId: string;
  occurrenceId: string;
}): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("schedule_reminders")
    .update({
      status: "canceled",
      canceled_at: now,
      updated_at: now,
    })
    .eq("user_id", input.userId)
    .eq("event_occurrence_id", input.occurrenceId)
    .eq("status", "pending")
    .select("id");

  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export async function getReminderOwnerStats(): Promise<{
  pending: number;
  sent: number;
  failed: number;
  canceled: number;
}> {
  const admin = getSupabaseAdmin();
  const statuses = ["pending", "sent", "failed", "canceled"] as const;
  const counts = { pending: 0, sent: 0, failed: 0, canceled: 0 };
  await Promise.all(
    statuses.map(async (status) => {
      const { count } = await admin
        .from("schedule_reminders")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      counts[status] = typeof count === "number" ? count : 0;
    }),
  );
  return counts;
}

export { loadPublishedOccurrenceStart };
