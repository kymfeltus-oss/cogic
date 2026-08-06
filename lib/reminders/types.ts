export const REMINDER_OFFSETS_MINUTES = [0, 15, 30] as const;
export type ReminderOffsetMinutes = (typeof REMINDER_OFFSETS_MINUTES)[number];

export const REMINDER_STATUSES = [
  "pending",
  "processing",
  "sent",
  "failed",
  "canceled",
] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export type ScheduleReminder = {
  id: string;
  userId: string;
  eventOccurrenceId: string;
  reminderOffsetMinutes: ReminderOffsetMinutes;
  dueAt: string;
  status: ReminderStatus;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  canceledAt: string | null;
};

export function isReminderOffsetMinutes(value: unknown): value is ReminderOffsetMinutes {
  return (
    typeof value === "number" &&
    (REMINDER_OFFSETS_MINUTES as readonly number[]).includes(value)
  );
}

export function computeReminderDueAt(
  scheduledStartAtIso: string,
  offsetMinutes: ReminderOffsetMinutes,
): string {
  const start = Date.parse(scheduledStartAtIso);
  if (!Number.isFinite(start)) {
    throw new Error("scheduledStartAt must be a valid timestamp.");
  }
  return new Date(start - offsetMinutes * 60_000).toISOString();
}

export function reminderOffsetLabel(offset: ReminderOffsetMinutes): string {
  if (offset === 0) return "At start";
  return `${offset} minutes before`;
}
