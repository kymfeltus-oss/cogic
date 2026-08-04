export const EVENT_TYPES = [
  "main_service",
  "revival_fire",
  "midnight_musical",
  "main_event_center_class",
  "morning_manna",
  "midday_worship",
  "special_event",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_STATUSES = ["draft", "published", "archived"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const OCCURRENCE_STATUSES = [
  "scheduled",
  "starting_soon",
  "next",
  "live",
  "delayed",
  "completed",
  "canceled",
] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

export const OCCURRENCE_VISIBILITIES = ["unpublished", "published"] as const;
export type OccurrenceVisibility = (typeof OCCURRENCE_VISIBILITIES)[number];

export const OCCURRENCE_START_MODES = ["fixed", "after_predecessor"] as const;
export type OccurrenceStartMode = (typeof OCCURRENCE_START_MODES)[number];

export const DEFAULT_PROGRAM_KEY = "cogic-stream-2026";

export type Event = {
  id: string;
  programKey: string;
  slug: string;
  title: string;
  eventType: EventType;
  description: string | null;
  status: EventStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type EventOccurrence = {
  id: string;
  eventId: string;
  titleOverride: string | null;
  status: OccurrenceStatus;
  visibility: OccurrenceVisibility;
  timezone: string;
  localDate: string;
  scheduledStartAt: string | null;
  estimatedStartAt: string | null;
  scheduledEndAt: string | null;
  venueLabel: string | null;
  followsOccurrenceId: string | null;
  startMode: OccurrenceStartMode;
  broadcastStateId: string | null;
  replayRecordingId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

/** Attendee-facing published occurrence row (joined with parent event). */
export type PublishedOccurrence = {
  occurrenceId: string;
  eventId: string;
  programKey: string;
  eventSlug: string;
  eventType: EventType;
  title: string;
  description: string | null;
  status: OccurrenceStatus;
  timezone: string;
  localDate: string;
  scheduledStartAt: string | null;
  estimatedStartAt: string | null;
  scheduledEndAt: string | null;
  venueLabel: string | null;
  followsOccurrenceId: string | null;
  startMode: OccurrenceStartMode;
  broadcastStateId: string | null;
  replayRecordingId: string | null;
  eventSortOrder: number;
};

export function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}

export function isEventStatus(value: string): value is EventStatus {
  return (EVENT_STATUSES as readonly string[]).includes(value);
}

export function isOccurrenceStatus(value: string): value is OccurrenceStatus {
  return (OCCURRENCE_STATUSES as readonly string[]).includes(value);
}

export function isOccurrenceVisibility(value: string): value is OccurrenceVisibility {
  return (OCCURRENCE_VISIBILITIES as readonly string[]).includes(value);
}

export function isOccurrenceStartMode(value: string): value is OccurrenceStartMode {
  return (OCCURRENCE_START_MODES as readonly string[]).includes(value);
}

export function parseEventType(value: string): EventType {
  if (!isEventType(value)) {
    throw new Error(`Invalid event_type: ${value}`);
  }
  return value;
}
