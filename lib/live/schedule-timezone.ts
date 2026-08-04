/** IANA timezones for ops countdown scheduling (event wall clock). */

export const SCHEDULE_TIMEZONE_OPTIONS = [
  { id: "America/New_York", label: "Eastern (ET)" },
  { id: "America/Chicago", label: "Central (CT)" },
  { id: "America/Denver", label: "Mountain (MT)" },
  { id: "America/Los_Angeles", label: "Pacific (PT)" },
  { id: "America/Phoenix", label: "Arizona" },
  { id: "America/Anchorage", label: "Alaska" },
  { id: "Pacific/Honolulu", label: "Hawaii" },
  { id: "UTC", label: "UTC" },
] as const;

export type ScheduleTimezone = (typeof SCHEDULE_TIMEZONE_OPTIONS)[number]["id"];

export const DEFAULT_SCHEDULE_TIMEZONE: ScheduleTimezone = "America/Chicago";

const SCHEDULE_TIMEZONE_IDS = new Set<string>(
  SCHEDULE_TIMEZONE_OPTIONS.map((option) => option.id),
);

const US_TIMEZONE_BY_OFFSET: Record<string, ScheduleTimezone> = {
  "-05:00": "America/Chicago",
  "-04:00": "America/New_York",
  "-06:00": "America/Chicago",
  "-07:00": "America/Denver",
  "-08:00": "America/Los_Angeles",
};

const DATETIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

type WallTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function getZonedWallTimeParts(ms: number, timeZone: string): WallTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(new Date(ms));

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "0";

  return {
    year: Number(pick("year")),
    month: Number(pick("month")),
    day: Number(pick("day")),
    hour: Number(pick("hour")),
    minute: Number(pick("minute")),
  };
}

function wallTimeAsUtcMs(parts: WallTimeParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
}

export function resolveScheduleTimezone(value: unknown): ScheduleTimezone {
  if (typeof value === "string" && SCHEDULE_TIMEZONE_IDS.has(value)) {
    return value as ScheduleTimezone;
  }
  return DEFAULT_SCHEDULE_TIMEZONE;
}

export function inferScheduleTimezoneFromIso(iso: string): ScheduleTimezone {
  const offsetMatch = iso.match(/([+-]\d{2}:\d{2})$/);
  if (!offsetMatch) return DEFAULT_SCHEDULE_TIMEZONE;
  return US_TIMEZONE_BY_OFFSET[offsetMatch[1]] ?? DEFAULT_SCHEDULE_TIMEZONE;
}

export function detectBrowserScheduleTimezone(): ScheduleTimezone {
  try {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (SCHEDULE_TIMEZONE_IDS.has(browserTz)) {
      return browserTz as ScheduleTimezone;
    }
  } catch {
    // fall through
  }
  return DEFAULT_SCHEDULE_TIMEZONE;
}

export function getScheduleTimezoneLabel(timeZone: string): string {
  const match = SCHEDULE_TIMEZONE_OPTIONS.find((option) => option.id === timeZone);
  return match?.label ?? timeZone;
}

/** Format ISO instant for `<input type="datetime-local" />` in a chosen IANA timezone. */
export function isoToScheduleDatetimeLocal(iso: string, timeZone: string): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";

  const parts = getZonedWallTimeParts(ms, timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

/** Parse datetime-local wall time in a chosen IANA timezone to UTC ISO. */
export function scheduleDatetimeLocalToIso(
  value: string,
  timeZone: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = DATETIME_LOCAL_PATTERN.exec(trimmed);
  if (!match) return null;

  const target: WallTimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };

  if (
    !Number.isFinite(target.year) ||
    !Number.isFinite(target.month) ||
    !Number.isFinite(target.day) ||
    !Number.isFinite(target.hour) ||
    !Number.isFinite(target.minute)
  ) {
    return null;
  }

  let utcMs = wallTimeAsUtcMs(target);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const wall = getZonedWallTimeParts(utcMs, timeZone);
    const deltaMs = wallTimeAsUtcMs(target) - wallTimeAsUtcMs(wall);
    if (deltaMs === 0) {
      const date = new Date(utcMs);
      if (Number.isNaN(date.getTime())) return null;
      return date.toISOString();
    }
    utcMs += deltaMs;
  }

  const date = new Date(utcMs);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function formatNowInScheduleTimezone(nowMs: number, timeZone: string): string {
  return new Date(nowMs).toLocaleString("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}
