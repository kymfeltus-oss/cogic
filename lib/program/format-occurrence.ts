import type { EventType, PublishedOccurrence } from "@/lib/events/types";
import {
  formatConvocationTime,
  resolveOccurrenceTimezone,
} from "@/lib/my-convocation/schedule";

const EVENT_TYPE_CATEGORY_LABELS: Record<EventType, string> = {
  main_service: "Main Services",
  revival_fire: "Revival Fire",
  midnight_musical: "Midnight Musical",
  main_event_center_class: "Classes",
  morning_manna: "Morning Manna",
  midday_worship: "Midday Worship",
  general_assembly: "General Assembly",
  special_event: "Special Event",
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  starting_soon: "Starting soon",
  next: "Up next",
  live: "Live now",
  delayed: "Delayed",
  completed: "Completed",
};

export function programCategoryLabel(eventType: EventType): string {
  return EVENT_TYPE_CATEGORY_LABELS[eventType] ?? "Convocation Event";
}

export function formatOccurrenceStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? "Scheduled";
}

export function formatOccurrenceEndTime(
  occurrence: PublishedOccurrence,
): string | null {
  if (!occurrence.scheduledEndAt) return null;
  return formatConvocationTime(
    occurrence.scheduledEndAt,
    resolveOccurrenceTimezone(occurrence.timezone),
  );
}

export function resolveProgramWatchLiveAction(input: {
  occurrence: PublishedOccurrence;
  broadcastIsLive: boolean;
  isLiveOccurrence: boolean;
}): { label: string; href: string } | null {
  if (!input.isLiveOccurrence) return null;
  if (input.occurrence.eventType !== "main_service" && !input.broadcastIsLive) {
    return null;
  }
  if (input.occurrence.status !== "live" && !input.broadcastIsLive) {
    return null;
  }
  return { label: "Watch Live", href: "/live" };
}

export function occurrenceStableKey(occurrence: PublishedOccurrence): string {
  return `${occurrence.eventSlug}:${occurrence.localDate}:${occurrence.occurrenceId}`;
}
