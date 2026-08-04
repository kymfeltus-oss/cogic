import type { EventStatus, OccurrenceStatus } from "@/lib/events/types";

/**
 * Domain transition helpers for future server writes.
 * Not security-authoritative — database constraints + admin auth remain required.
 */

const EVENT_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  draft: ["published"],
  published: ["archived"],
  archived: ["published"],
};

/**
 * Occurrence lifecycle transitions.
 * `canceled` is terminal for schedule purposes.
 * `completed` is terminal unless explicitly reopened later (not in v1).
 */
const OCCURRENCE_TRANSITIONS: Record<OccurrenceStatus, readonly OccurrenceStatus[]> = {
  scheduled: ["starting_soon", "next", "live", "delayed", "completed", "canceled"],
  starting_soon: ["next", "live", "delayed", "completed", "canceled"],
  next: ["starting_soon", "live", "delayed", "completed", "canceled"],
  live: ["delayed", "completed", "canceled"],
  delayed: ["starting_soon", "next", "live", "completed", "canceled"],
  completed: [],
  canceled: [],
};

export function canTransitionEventStatus(
  from: EventStatus,
  to: EventStatus,
): boolean {
  if (from === to) return true;
  return EVENT_TRANSITIONS[from].includes(to);
}

export function assertEventStatusTransition(from: EventStatus, to: EventStatus): void {
  if (!canTransitionEventStatus(from, to)) {
    throw new Error(`Invalid event status transition: ${from} → ${to}`);
  }
}

export function canTransitionOccurrenceStatus(
  from: OccurrenceStatus,
  to: OccurrenceStatus,
): boolean {
  if (from === to) return true;
  return OCCURRENCE_TRANSITIONS[from].includes(to);
}

export function assertOccurrenceStatusTransition(
  from: OccurrenceStatus,
  to: OccurrenceStatus,
): void {
  if (!canTransitionOccurrenceStatus(from, to)) {
    throw new Error(`Invalid occurrence status transition: ${from} → ${to}`);
  }
}

export function listAllowedEventTransitions(from: EventStatus): readonly EventStatus[] {
  return EVENT_TRANSITIONS[from];
}

export function listAllowedOccurrenceTransitions(
  from: OccurrenceStatus,
): readonly OccurrenceStatus[] {
  return OCCURRENCE_TRANSITIONS[from];
}
