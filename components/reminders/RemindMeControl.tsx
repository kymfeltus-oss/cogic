"use client";

import { useCallback, useEffect, useState } from "react";
import {
  REMINDER_OFFSETS_MINUTES,
  reminderOffsetLabel,
  type ReminderOffsetMinutes,
  type ScheduleReminder,
} from "@/lib/reminders/types";

type RemindMeControlProps = {
  occurrenceId: string;
  canRemind: boolean;
  signedIn: boolean;
};

export default function RemindMeControl({
  occurrenceId,
  canRemind,
  signedIn,
}: RemindMeControlProps) {
  const [reminder, setReminder] = useState<ScheduleReminder | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!signedIn) return;
    try {
      const response = await fetch("/api/reminders", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as { reminders?: ScheduleReminder[] };
      const match =
        (data.reminders ?? []).find(
          (item) =>
            item.eventOccurrenceId === occurrenceId && item.status === "pending",
        ) ?? null;
      setReminder(match);
    } catch {
      // Non-blocking
    }
  }, [occurrenceId, signedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canRemind) return null;

  if (!signedIn) {
    return (
      <a
        href={`/login?next=${encodeURIComponent("/program")}`}
        className="convocation-program-btn convocation-program-btn-secondary"
      >
        Sign in to set reminder
      </a>
    );
  }

  async function save(offset: ReminderOffsetMinutes) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/reminders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occurrenceId, offsetMinutes: offset }),
      });
      const data = (await response.json()) as {
        reminder?: ScheduleReminder;
        error?: string;
      };
      if (!response.ok || !data.reminder) {
        throw new Error(data.error || "Unable to save reminder.");
      }
      setReminder(data.reminder);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save reminder.");
    } finally {
      setSaving(false);
    }
  }

  async function cancel() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/reminders", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occurrenceId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Unable to cancel reminder.");
      }
      setReminder(null);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel reminder.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3">
      {reminder ? (
        <div className="flex flex-wrap gap-2">
          <p className="w-full text-xs text-white/65">
            Reminder set: {reminderOffsetLabel(reminder.reminderOffsetMinutes)}
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={() => setOpen((value) => !value)}
            className="convocation-program-btn convocation-program-btn-secondary"
          >
            Change reminder
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void cancel()}
            className="convocation-program-btn convocation-program-btn-secondary"
          >
            Cancel reminder
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={saving}
          onClick={() => setOpen((value) => !value)}
          className="convocation-program-btn convocation-program-btn-secondary"
        >
          Remind me
        </button>
      )}

      {open ? (
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Reminder options">
          {REMINDER_OFFSETS_MINUTES.map((offset) => (
            <button
              key={offset}
              type="button"
              disabled={saving}
              onClick={() => void save(offset)}
              className="convocation-program-btn convocation-program-btn-secondary"
            >
              {reminderOffsetLabel(offset)}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
