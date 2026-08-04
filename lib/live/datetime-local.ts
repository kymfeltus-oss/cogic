/** Local datetime-local input ↔ ISO helpers (timezone-safe for admin editors). */

const DATETIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Format ISO timestamp for `<input type="datetime-local" />` in the operator's local TZ. */
export function isoToDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Parse datetime-local value as local wall time (not UTC).
 * Avoids browser inconsistencies with `new Date("YYYY-MM-DDTHH:mm")`.
 */
export function datetimeLocalValueToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = DATETIME_LOCAL_PATTERN.exec(trimmed);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(date.getTime())) return null;

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }

  return date.toISOString();
}

export function validateCountdownScheduleTimes(
  startIso: string,
  endIso: string,
): string | null {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return "Enter valid start and end times.";
  }

  if (endMs <= startMs) {
    return "Show end must be after go-live time.";
  }

  return null;
}
