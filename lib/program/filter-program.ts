import type { EventType } from "@/lib/events/types";
import type {
  ProgramCategoryFilter,
  ProgramCategoryId,
  ProgramOccurrenceDTO,
} from "@/lib/program/types";
import { PROGRAM_CATEGORY_DEFINITIONS } from "@/lib/program/types";

export function normalizeProgramSearchQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function parseProgramCategory(value: string | undefined): ProgramCategoryId {
  const normalized = value?.trim();
  if (
    normalized &&
    PROGRAM_CATEGORY_DEFINITIONS.some((category) => category.id === normalized)
  ) {
    return normalized as ProgramCategoryId;
  }
  return "all";
}

export function isValidProgramDay(day: string, publishedDayDates: string[]): boolean {
  return publishedDayDates.includes(day);
}

export function getAvailableProgramCategories(
  occurrences: ProgramOccurrenceDTO[],
): ProgramCategoryFilter[] {
  const presentTypes = new Set<EventType>(occurrences.map((item) => item.eventType));

  return PROGRAM_CATEGORY_DEFINITIONS.filter((category) => {
    if (category.id === "all") return occurrences.length > 0;
    return category.eventTypes.some((type) => presentTypes.has(type));
  });
}

function matchesCategory(
  occurrence: ProgramOccurrenceDTO,
  category: ProgramCategoryId,
): boolean {
  if (category === "all") return true;
  const definition = PROGRAM_CATEGORY_DEFINITIONS.find((item) => item.id === category);
  if (!definition) return true;
  return definition.eventTypes.includes(occurrence.eventType);
}

function matchesSearch(occurrence: ProgramOccurrenceDTO, searchQuery: string): boolean {
  if (!searchQuery) return true;
  const haystack = [
    occurrence.title,
    occurrence.description ?? "",
    occurrence.venueLabel ?? "",
    occurrence.categoryLabel,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(searchQuery.toLowerCase());
}

export function filterProgramOccurrences(
  occurrences: ProgramOccurrenceDTO[],
  input: { category: ProgramCategoryId; searchQuery: string },
): ProgramOccurrenceDTO[] {
  const searchQuery = normalizeProgramSearchQuery(input.searchQuery);

  return occurrences.filter(
    (occurrence) =>
      matchesCategory(occurrence, input.category) &&
      matchesSearch(occurrence, searchQuery),
  );
}

export function buildProgramQueryString(input: {
  day?: string | null;
  category?: ProgramCategoryId;
  searchQuery?: string;
}): string {
  const params = new URLSearchParams();
  if (input.day) params.set("day", input.day);
  if (input.category && input.category !== "all") {
    params.set("category", input.category);
  }
  const search = normalizeProgramSearchQuery(input.searchQuery ?? "");
  if (search) params.set("q", search);
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}
