import type { EventType, PublishedOccurrence } from "@/lib/events/types";
import { sortPublishedOccurrences } from "@/lib/events/published-query";
import {
  buildOccurrenceLookup,
  formatConvocationDate,
  getChicagoLocalDate,
  resolveLiveOccurrence,
  resolveOccurrenceTiming,
} from "@/lib/my-convocation/schedule";
import {
  formatOccurrenceEndTime,
  formatOccurrenceStatusLabel,
  occurrenceStableKey,
  programCategoryLabel,
  resolveProgramWatchLiveAction,
} from "@/lib/program/format-occurrence";
import type {
  ProgramOccurrenceDTO,
  ProgramViewState,
} from "@/lib/program/types";
import {
  PROGRAM_CATEGORY_DEFINITIONS,
  PROGRAM_EMPTY_MESSAGES,
  type ProgramCategoryId,
  type ProgramEmptyStateKind,
} from "@/lib/program/types";
import {
  filterProgramOccurrences,
  getAvailableProgramCategories,
  isValidProgramDay,
  normalizeProgramSearchQuery,
  parseProgramCategory,
} from "@/lib/program/filter-program";

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseProgramDayParam(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (!LOCAL_DATE_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function resolveDefaultProgramDay(
  publishedDayDates: string[],
  now = new Date(),
): string | null {
  if (publishedDayDates.length === 0) return null;

  const sorted = [...publishedDayDates].sort();
  const today = getChicagoLocalDate(now);

  if (sorted.includes(today)) {
    return today;
  }

  const upcoming = sorted.find((day) => day > today);
  if (upcoming) {
    return upcoming;
  }

  return sorted[sorted.length - 1] ?? null;
}

/** Place flexible after_predecessor occurrences directly after their predecessor. */
export function orderDayOccurrencesWithPredecessors(
  items: PublishedOccurrence[],
): PublishedOccurrence[] {
  const baseSorted = sortPublishedOccurrences(items);
  const result: PublishedOccurrence[] = [];
  const placed = new Set<string>();

  for (const item of baseSorted) {
    if (placed.has(item.occurrenceId)) continue;

    if (item.startMode === "after_predecessor") {
      continue;
    }

    result.push(item);
    placed.add(item.occurrenceId);

    for (const follower of baseSorted) {
      if (
        follower.startMode === "after_predecessor" &&
        follower.followsOccurrenceId === item.occurrenceId &&
        !placed.has(follower.occurrenceId)
      ) {
        result.push(follower);
        placed.add(follower.occurrenceId);
      }
    }
  }

  for (const item of baseSorted) {
    if (!placed.has(item.occurrenceId)) {
      result.push(item);
    }
  }

  return result;
}

export function mapPublishedOccurrenceToProgramDTO(
  occurrence: PublishedOccurrence,
  lookup: Map<string, PublishedOccurrence>,
  input: { broadcastIsLive: boolean; liveOccurrenceId: string | null },
): ProgramOccurrenceDTO {
  const timing = resolveOccurrenceTiming(occurrence, lookup);
  const isLiveOccurrence =
    occurrence.status === "live" ||
    (input.liveOccurrenceId !== null &&
      occurrence.occurrenceId === input.liveOccurrenceId);

  const canRemind =
    !isLiveOccurrence &&
    occurrence.status !== "canceled" &&
    occurrence.status !== "completed" &&
    Boolean(occurrence.scheduledStartAt) &&
    Date.parse(occurrence.scheduledStartAt as string) > Date.now();

  return {
    occurrenceKey: occurrenceStableKey(occurrence),
    occurrenceId: occurrence.occurrenceId,
    title: occurrence.title,
    eventType: occurrence.eventType,
    categoryLabel: programCategoryLabel(occurrence.eventType),
    localDate: occurrence.localDate,
    timePrimary: timing.primary,
    timeSecondary: timing.secondary,
    endTimeLabel: formatOccurrenceEndTime(occurrence),
    venueLabel: occurrence.venueLabel,
    description: occurrence.description,
    status: occurrence.status,
    statusLabel: formatOccurrenceStatusLabel(occurrence.status),
    isLiveNow: isLiveOccurrence,
    canRemind,
    watchLiveAction: resolveProgramWatchLiveAction({
      occurrence,
      broadcastIsLive: input.broadcastIsLive,
      isLiveOccurrence,
    }),
  };
}

export function buildProgramOccurrenceDTOs(
  occurrences: PublishedOccurrence[],
  broadcastIsLive: boolean,
): ProgramOccurrenceDTO[] {
  const lookup = buildOccurrenceLookup(occurrences);
  const liveOccurrence = resolveLiveOccurrence(occurrences, broadcastIsLive);

  return orderDayOccurrencesWithPredecessors(occurrences).map((occurrence) =>
    mapPublishedOccurrenceToProgramDTO(occurrence, lookup, {
      broadcastIsLive,
      liveOccurrenceId: liveOccurrence?.occurrenceId ?? null,
    }),
  );
}

export function buildProgramViewState(input: {
  occurrences: PublishedOccurrence[];
  broadcastIsLive: boolean;
  dayParam?: string;
  categoryParam?: string;
  searchParam?: string;
  now?: Date;
}): ProgramViewState {
  const now = input.now ?? new Date();
  const allDtos = buildProgramOccurrenceDTOs(input.occurrences, input.broadcastIsLive);
  const publishedDayDates = [...new Set(allDtos.map((item) => item.localDate))].sort();
  const defaultDay = resolveDefaultProgramDay(publishedDayDates, now);
  const parsedDay = parseProgramDayParam(input.dayParam);
  const selectedDay =
    parsedDay && isValidProgramDay(parsedDay, publishedDayDates)
      ? parsedDay
      : defaultDay;

  const activeCategory = parseProgramCategory(input.categoryParam);
  const searchQuery = normalizeProgramSearchQuery(input.searchParam ?? "");

  if (publishedDayDates.length === 0) {
    return {
      programKey: "cogic-stream-2026",
      publishedDayDates,
      selectedDay: null,
      selectedDayHeading: null,
      occurrences: [],
      availableCategories: [],
      activeCategory,
      searchQuery,
      resultCount: 0,
      emptyState: "no_schedule",
      emptyMessage: PROGRAM_EMPTY_MESSAGES.no_schedule,
      broadcastIsLive: input.broadcastIsLive,
    };
  }

  const dayOccurrences = allDtos.filter((item) => item.localDate === selectedDay);
  const availableCategories = getAvailableProgramCategories(dayOccurrences);
  const filtered = filterProgramOccurrences(dayOccurrences, {
    category: activeCategory,
    searchQuery,
  });

  let emptyState: ProgramEmptyStateKind | null = null;
  if (dayOccurrences.length === 0) {
    emptyState = "no_day_events";
  } else if (filtered.length === 0) {
    emptyState = "no_filter_matches";
  }

  return {
    programKey: "cogic-stream-2026",
    publishedDayDates,
    selectedDay,
    selectedDayHeading: selectedDay ? formatConvocationDate(selectedDay) : null,
    occurrences: filtered,
    availableCategories,
    activeCategory,
    searchQuery,
    resultCount: filtered.length,
    emptyState,
    emptyMessage: emptyState ? PROGRAM_EMPTY_MESSAGES[emptyState] : "",
    broadcastIsLive: input.broadcastIsLive,
  };
}

export function eventTypesForCategory(category: ProgramCategoryId): EventType[] {
  return (
    PROGRAM_CATEGORY_DEFINITIONS.find((item) => item.id === category)?.eventTypes ?? []
  );
}
