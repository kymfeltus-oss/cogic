const US_TIMEZONE_BY_OFFSET: Record<string, string> = {
  "-05:00": "America/Chicago",
  "-06:00": "America/Chicago",
  "-07:00": "America/Denver",
  "-08:00": "America/Los_Angeles",
  "-04:00": "America/New_York",
};

const DEFAULT_EVENT_TIMEZONE = "America/Chicago";

function resolveTimeZoneFromIso(startIso: string): string {
  const offsetMatch = startIso.match(/([+-]\d{2}:\d{2})$/);
  if (!offsetMatch) return DEFAULT_EVENT_TIMEZONE;
  return US_TIMEZONE_BY_OFFSET[offsetMatch[1]] ?? DEFAULT_EVENT_TIMEZONE;
}

export function formatHoldingRoomEventDate(startIso: string): string {
  const timeZone = resolveTimeZoneFromIso(startIso);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(new Date(startIso));
}

export function formatHoldingRoomEventTime(startIso: string): string {
  const timeZone = resolveTimeZoneFromIso(startIso);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone,
  }).format(new Date(startIso));
}

function formatIcsUtc(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Downloads a calendar invite for the live event start/end window. */
export function downloadHoldingRoomCalendar(config: {
  headline: string;
  subtitle: string;
  start_time: string;
  end_time: string;
}): void {
  const dtStart = formatIcsUtc(config.start_time);
  const dtEnd = formatIcsUtc(config.end_time);
  if (!dtStart || !dtEnd) return;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//COGIC LIVE//Holy Convocation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:cogic-live-${dtStart}@cogiclive.com`,
    `DTSTAMP:${formatIcsUtc(new Date().toISOString())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${config.headline.replace(/\r?\n/g, " ")}`,
    `DESCRIPTION:${config.subtitle.replace(/\r?\n/g, " ")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "cogic-live-event.ics";
  anchor.click();
  URL.revokeObjectURL(url);
}
