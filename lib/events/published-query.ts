import {
  DEFAULT_PROGRAM_KEY,
  isEventType,
  isOccurrenceStatus,
  type EventType,
  type OccurrenceStatus,
  type PublishedOccurrence,
} from "@/lib/events/types";

export type OccurrenceJoinRow = {
  id: string;
  event_id: string;
  title_override: string | null;
  status: string;
  visibility: string;
  timezone: string;
  local_date: string;
  scheduled_start_at: string | null;
  estimated_start_at: string | null;
  scheduled_end_at: string | null;
  venue_label: string | null;
  follows_occurrence_id: string | null;
  start_mode: string;
  broadcast_state_id: string | null;
  replay_recording_id: string | null;
  events: {
    id: string;
    program_key: string;
    slug: string;
    title: string;
    event_type: string;
    description: string | null;
    status: string;
    sort_order: number;
  } | null;
};

export type PublishedOccurrenceFilters = {
  programKey?: string;
  date?: string;
  type?: EventType;
};

export function mapPublishedOccurrence(
  row: OccurrenceJoinRow,
): PublishedOccurrence | null {
  const event = row.events;
  if (!event) return null;
  if (event.status !== "published") return null;
  if (row.visibility !== "published") return null;
  if (row.status === "canceled") return null;
  if (!isEventType(event.event_type)) return null;
  if (!isOccurrenceStatus(row.status)) return null;

  return {
    occurrenceId: row.id,
    eventId: event.id,
    programKey: event.program_key,
    eventSlug: event.slug,
    eventType: event.event_type,
    title: row.title_override?.trim() || event.title,
    description: event.description,
    status: row.status as OccurrenceStatus,
    timezone: row.timezone,
    localDate: row.local_date,
    scheduledStartAt: row.scheduled_start_at,
    estimatedStartAt: row.estimated_start_at,
    scheduledEndAt: row.scheduled_end_at,
    venueLabel: row.venue_label,
    followsOccurrenceId: row.follows_occurrence_id,
    startMode: row.start_mode === "after_predecessor" ? "after_predecessor" : "fixed",
    broadcastStateId: row.broadcast_state_id,
    replayRecordingId: row.replay_recording_id,
    eventSortOrder: event.sort_order,
  };
}

export function sortPublishedOccurrences(
  rows: PublishedOccurrence[],
): PublishedOccurrence[] {
  return [...rows].sort((a, b) => {
    if (a.localDate !== b.localDate) {
      return a.localDate < b.localDate ? -1 : 1;
    }

    const aStart = a.scheduledStartAt ?? a.estimatedStartAt;
    const bStart = b.scheduledStartAt ?? b.estimatedStartAt;
    const aMs = aStart ? Date.parse(aStart) : Number.POSITIVE_INFINITY;
    const bMs = bStart ? Date.parse(bStart) : Number.POSITIVE_INFINITY;
    if (aMs !== bMs) return aMs - bMs;

    if (a.eventSortOrder !== b.eventSortOrder) {
      return a.eventSortOrder - b.eventSortOrder;
    }

    return a.title.localeCompare(b.title);
  });
}

/** Pure published-only filter for repository rules and unit tests. */
export function filterPublishedOccurrenceCandidates(
  rows: OccurrenceJoinRow[],
  input: PublishedOccurrenceFilters = {},
): PublishedOccurrence[] {
  const programKey = input.programKey?.trim() || DEFAULT_PROGRAM_KEY;

  const mapped = rows
    .filter((row) => row.events?.program_key === programKey)
    .filter((row) => (input.date ? row.local_date === input.date : true))
    .filter((row) => (input.type ? row.events?.event_type === input.type : true))
    .map(mapPublishedOccurrence)
    .filter((row): row is PublishedOccurrence => row !== null);

  return sortPublishedOccurrences(mapped);
}
