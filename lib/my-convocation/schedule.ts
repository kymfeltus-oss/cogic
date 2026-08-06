import type { PublishedOccurrence } from "@/lib/events/types";

export const DEFAULT_CONVOCATION_TIMEZONE = "America/Chicago";

const EVENT_TYPE_LABELS: Record<string, string> = {
  main_service: "Main Services",
  revival_fire: "Revival Fire",
  midnight_musical: "Midnight Musical",
  main_event_center_class: "Main Event Center Classes",
  morning_manna: "Morning Manna",
  midday_worship: "Midday Worship",
  general_assembly: "General Assembly",
  special_event: "Special Event",
};

export type OccurrenceTiming = {
  primary: string;
  secondary: string | null;
};

export function occurrenceStableKey(occurrence: PublishedOccurrence): string {
  return `${occurrence.eventSlug}:${occurrence.localDate}`;
}

export function resolveOccurrenceTimezone(timezone: string | null | undefined): string {
  const trimmed = timezone?.trim();
  return trimmed || DEFAULT_CONVOCATION_TIMEZONE;
}

export function formatConvocationDate(
  localDate: string,
  timezone = DEFAULT_CONVOCATION_TIMEZONE,
): string {
  const parsed = parseLocalDate(localDate);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  }).format(parsed);
}

export function formatConvocationTime(
  isoTimestamp: string,
  timezone = DEFAULT_CONVOCATION_TIMEZONE,
): string {
  const date = new Date(isoTimestamp);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  }).format(date);

  const zone =
    timezone === DEFAULT_CONVOCATION_TIMEZONE
      ? "CT"
      : new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          timeZoneName: "short",
        })
          .formatToParts(date)
          .find((part) => part.type === "timeZoneName")?.value ?? timezone;

  return `${time} ${zone}`;
}

function parseLocalDate(localDate: string): Date {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function getChicagoLocalDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_CONVOCATION_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function resolveOccurrenceTiming(
  occurrence: PublishedOccurrence,
  occurrencesById: Map<string, PublishedOccurrence>,
): OccurrenceTiming {
  if (occurrence.startMode !== "after_predecessor") {
    const start = occurrence.scheduledStartAt ?? occurrence.estimatedStartAt;
    return {
      primary: start
        ? formatConvocationTime(start, resolveOccurrenceTimezone(occurrence.timezone))
        : "Time to be announced",
      secondary: null,
    };
  }

  const predecessor = occurrence.followsOccurrenceId
    ? occurrencesById.get(occurrence.followsOccurrenceId)
    : null;
  const predecessorTitle = predecessor?.title ?? "Evening Worship";
  const secondaryParts = ["Start time may vary."];
  if (occurrence.estimatedStartAt) {
    secondaryParts.push(
      `Estimated around ${formatConvocationTime(
        occurrence.estimatedStartAt,
        resolveOccurrenceTimezone(occurrence.timezone),
      )}`,
    );
  }

  return {
    primary: `Following ${predecessorTitle}`,
    secondary: secondaryParts.join(" "),
  };
}

/** @deprecated Use resolveOccurrenceTiming().primary */
export function resolveFlexibleStartLabel(
  occurrence: PublishedOccurrence,
  occurrencesById: Map<string, PublishedOccurrence>,
): string {
  return resolveOccurrenceTiming(occurrence, occurrencesById).primary;
}

export function mapPublishedOccurrenceToScheduleItem(
  occurrence: PublishedOccurrence,
  occurrencesById: Map<string, PublishedOccurrence>,
  liveNow: boolean,
): import("@/lib/my-convocation/types").ScheduleOccurrenceDTO {
  const timing = resolveOccurrenceTiming(occurrence, occurrencesById);
  return {
    occurrenceKey: occurrenceStableKey(occurrence),
    title: occurrence.title,
    eventType: occurrence.eventType,
    localDate: occurrence.localDate,
    timeLabel: timing.primary,
    timeSecondaryLabel: timing.secondary,
    venueLabel: occurrence.venueLabel,
    status: occurrence.status,
    isLiveNow: liveNow || occurrence.status === "live",
  };
}

export function buildOccurrenceLookup(
  occurrences: PublishedOccurrence[],
): Map<string, PublishedOccurrence> {
  return new Map(occurrences.map((item) => [item.occurrenceId, item]));
}

export function filterOccurrencesForLocalDate(
  occurrences: PublishedOccurrence[],
  localDate: string,
): PublishedOccurrence[] {
  return occurrences.filter((item) => item.localDate === localDate);
}

export function filterUpcomingOccurrences(
  occurrences: PublishedOccurrence[],
  localDate: string,
): PublishedOccurrence[] {
  return occurrences.filter((item) => item.localDate > localDate);
}

export function resolveLiveOccurrence(
  occurrences: PublishedOccurrence[],
  broadcastIsLive: boolean,
): PublishedOccurrence | null {
  const markedLive = occurrences.find((item) => item.status === "live");
  if (markedLive) return markedLive;
  if (!broadcastIsLive) return null;
  return (
    occurrences.find(
      (item) =>
        item.localDate === getChicagoLocalDate() &&
        (item.status === "starting_soon" || item.status === "next" || item.status === "delayed"),
    ) ?? null
  );
}

export function resolveNextOccurrenceToday(
  occurrences: PublishedOccurrence[],
  now = new Date(),
): PublishedOccurrence | null {
  const today = getChicagoLocalDate(now);
  const todayItems = filterOccurrencesForLocalDate(occurrences, today);
  const future = todayItems.filter((item) => {
    if (item.status === "completed" || item.status === "canceled") return false;
    const start = item.scheduledStartAt ?? item.estimatedStartAt;
    if (!start && item.startMode === "after_predecessor") return true;
    if (!start) return false;
    return Date.parse(start) >= now.getTime();
  });

  if (future.length === 0) return null;

  return future.sort((a, b) => {
    const aStart = a.scheduledStartAt ?? a.estimatedStartAt;
    const bStart = b.scheduledStartAt ?? b.estimatedStartAt;
    const aMs = aStart ? Date.parse(aStart) : Number.POSITIVE_INFINITY;
    const bMs = bStart ? Date.parse(bStart) : Number.POSITIVE_INFINITY;
    return aMs - bMs;
  })[0]!;
}

function formatNowNextSecondary(
  occurrence: PublishedOccurrence,
  lookup: Map<string, PublishedOccurrence>,
): string | null {
  const timing = resolveOccurrenceTiming(occurrence, lookup);
  return timing.secondary ?? timing.primary;
}

export function buildNowNextSection(input: {
  publishedOccurrences: PublishedOccurrence[];
  broadcastIsLive: boolean;
  hasPublishedSchedule: boolean;
  now?: Date;
}): import("@/lib/my-convocation/types").NowNextDTO {
  const now = input.now ?? new Date();
  const lookup = buildOccurrenceLookup(input.publishedOccurrences);
  const liveOccurrence = resolveLiveOccurrence(input.publishedOccurrences, input.broadcastIsLive);

  if (liveOccurrence) {
    return {
      state: "live_now",
      contextLabel: "Live now",
      primaryLabel: liveOccurrence.title,
      secondaryLabel: formatNowNextSecondary(liveOccurrence, lookup),
      primaryAction: {
        label: "Watch Live",
        href: "/live",
      },
    };
  }

  if (!input.hasPublishedSchedule) {
    return {
      state: "no_schedule",
      contextLabel: "Schedule",
      primaryLabel: "The Convocation schedule has not been published yet.",
      secondaryLabel: null,
      primaryAction: null,
    };
  }

  const nextToday = resolveNextOccurrenceToday(input.publishedOccurrences, now);
  if (nextToday) {
    const timing = resolveOccurrenceTiming(nextToday, lookup);
    return {
      state: "next_event",
      contextLabel: "Up next today",
      primaryLabel: nextToday.title,
      secondaryLabel: timing.secondary ?? timing.primary,
      primaryAction: null,
    };
  }

  const today = getChicagoLocalDate(now);
  const hasTodayItems = input.publishedOccurrences.some((item) => item.localDate === today);

  if (hasTodayItems) {
    return {
      state: "no_events_today",
      contextLabel: "Today",
      primaryLabel: "There are no published events remaining today.",
      secondaryLabel: null,
      primaryAction: null,
    };
  }

  return {
    state: "no_schedule",
    contextLabel: "Schedule",
    primaryLabel: "The Convocation schedule has not been published yet.",
    secondaryLabel: null,
    primaryAction: null,
  };
}

export function eventTypeLabel(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] ?? "Convocation Event";
}
