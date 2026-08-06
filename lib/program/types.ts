import type { EventType, OccurrenceStatus } from "@/lib/events/types";

/** Allowlisted attendee-facing program occurrence DTO. */
export type ProgramOccurrenceDTO = {
  occurrenceKey: string;
  occurrenceId: string;
  title: string;
  eventType: EventType;
  categoryLabel: string;
  localDate: string;
  timePrimary: string;
  timeSecondary: string | null;
  endTimeLabel: string | null;
  venueLabel: string | null;
  description: string | null;
  status: OccurrenceStatus;
  statusLabel: string;
  isLiveNow: boolean;
  canRemind: boolean;
  watchLiveAction: { label: string; href: string } | null;
};

export type ProgramDayDTO = {
  localDate: string;
  heading: string;
  occurrences: ProgramOccurrenceDTO[];
};

export type ProgramCategoryId =
  | "all"
  | "worship_services"
  | "general_assembly"
  | "revival_fire"
  | "midnight_musical"
  | "classes"
  | "other";

export type ProgramCategoryFilter = {
  id: ProgramCategoryId;
  label: string;
  eventTypes: EventType[];
};

export type ProgramEmptyStateKind =
  | "no_schedule"
  | "no_day_events"
  | "no_filter_matches";

export type ProgramViewState = {
  programKey: string;
  publishedDayDates: string[];
  selectedDay: string | null;
  selectedDayHeading: string | null;
  occurrences: ProgramOccurrenceDTO[];
  availableCategories: ProgramCategoryFilter[];
  activeCategory: ProgramCategoryId;
  searchQuery: string;
  resultCount: number;
  emptyState: ProgramEmptyStateKind | null;
  emptyMessage: string;
  broadcastIsLive: boolean;
};

export const PROGRAM_CATEGORY_DEFINITIONS: readonly ProgramCategoryFilter[] = [
  {
    id: "all",
    label: "All Events",
    eventTypes: [],
  },
  {
    id: "worship_services",
    label: "Worship & Services",
    eventTypes: ["main_service", "morning_manna", "midday_worship"],
  },
  {
    id: "general_assembly",
    label: "General Assembly",
    eventTypes: ["general_assembly"],
  },
  {
    id: "revival_fire",
    label: "Revival Fire",
    eventTypes: ["revival_fire"],
  },
  {
    id: "midnight_musical",
    label: "Midnight Musical",
    eventTypes: ["midnight_musical"],
  },
  {
    id: "classes",
    label: "Classes",
    eventTypes: ["main_event_center_class"],
  },
  {
    id: "other",
    label: "Other",
    eventTypes: ["special_event"],
  },
] as const;

export const PROGRAM_EMPTY_MESSAGES: Record<ProgramEmptyStateKind, string> = {
  no_schedule: "The Convocation schedule has not been published yet.",
  no_day_events: "No published events are available for this day.",
  no_filter_matches: "No events match these filters.",
};
