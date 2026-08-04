import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterPublishedOccurrenceCandidates,
  sortPublishedOccurrences,
  type OccurrenceJoinRow,
} from "../published-query.ts";
import type { PublishedOccurrence } from "../types.ts";

function row(partial: {
  id: string;
  local_date: string;
  status?: string;
  visibility?: string;
  title_override?: string | null;
  scheduled_start_at?: string | null;
  estimated_start_at?: string | null;
  program_key?: string;
  event_type?: string;
  event_status?: string;
  sort_order?: number;
  title?: string;
}): OccurrenceJoinRow {
  return {
    id: partial.id,
    event_id: `event-${partial.id}`,
    title_override: partial.title_override ?? null,
    status: partial.status ?? "scheduled",
    visibility: partial.visibility ?? "published",
    timezone: "America/Chicago",
    local_date: partial.local_date,
    scheduled_start_at: partial.scheduled_start_at ?? null,
    estimated_start_at: partial.estimated_start_at ?? null,
    scheduled_end_at: null,
    venue_label: null,
    follows_occurrence_id: null,
    start_mode: "fixed",
    broadcast_state_id: null,
    replay_recording_id: null,
    events: {
      id: `event-${partial.id}`,
      program_key: partial.program_key ?? "cogic-stream-2026",
      slug: partial.id,
      title: partial.title ?? partial.id,
      event_type: partial.event_type ?? "main_service",
      description: null,
      status: partial.event_status ?? "published",
      sort_order: partial.sort_order ?? 0,
    },
  };
}

describe("published occurrence query rules", () => {
  it("excludes draft events, unpublished and canceled occurrences", () => {
    const result = filterPublishedOccurrenceCandidates([
      row({ id: "a", local_date: "2026-11-10", event_status: "draft" }),
      row({ id: "b", local_date: "2026-11-10", visibility: "unpublished" }),
      row({ id: "c", local_date: "2026-11-10", status: "canceled" }),
      row({
        id: "d",
        local_date: "2026-11-10",
        scheduled_start_at: "2026-11-10T19:00:00-06:00",
        title: "Evening Worship",
      }),
      row({
        id: "e",
        local_date: "2026-11-10",
        status: "completed",
        scheduled_start_at: "2026-11-10T18:00:00-06:00",
        title: "Completed Service",
      }),
    ]);

    assert.deepEqual(
      result.map((item) => item.occurrenceId),
      ["e", "d"],
    );
  });

  it("enforces program_key isolation and type/date filters", () => {
    const rows = [
      row({
        id: "rf",
        local_date: "2026-11-12",
        event_type: "revival_fire",
        scheduled_start_at: "2026-11-12T23:00:00-06:00",
        title: "Revival Fire",
      }),
      row({
        id: "mm",
        local_date: "2026-11-13",
        event_type: "midnight_musical",
        scheduled_start_at: "2026-11-14T00:00:00-06:00",
        title: "Midnight Musical",
      }),
      row({
        id: "other",
        local_date: "2026-11-12",
        program_key: "other-program",
        event_type: "revival_fire",
        scheduled_start_at: "2026-11-12T23:00:00-06:00",
      }),
    ];

    const byType = filterPublishedOccurrenceCandidates(rows, {
      type: "midnight_musical",
    });
    assert.equal(byType.length, 1);
    assert.equal(byType[0]?.eventType, "midnight_musical");

    const byDate = filterPublishedOccurrenceCandidates(rows, {
      date: "2026-11-12",
    });
    assert.equal(byDate.length, 1);
    assert.equal(byDate[0]?.eventType, "revival_fire");

    const isolated = filterPublishedOccurrenceCandidates(rows, {
      programKey: "other-program",
    });
    assert.equal(isolated.length, 1);
    assert.equal(isolated[0]?.programKey, "other-program");
  });

  it("orders by date, coalesce start, sort_order, title", () => {
    const sorted = sortPublishedOccurrences([
      {
        occurrenceId: "2",
        eventId: "e2",
        programKey: "cogic-stream-2026",
        eventSlug: "b",
        eventType: "main_service",
        title: "Beta",
        description: null,
        status: "scheduled",
        timezone: "America/Chicago",
        localDate: "2026-11-10",
        scheduledStartAt: null,
        estimatedStartAt: "2026-11-10T20:00:00-06:00",
        scheduledEndAt: null,
        venueLabel: null,
        followsOccurrenceId: null,
        startMode: "fixed",
        broadcastStateId: null,
        replayRecordingId: null,
        eventSortOrder: 1,
      },
      {
        occurrenceId: "1",
        eventId: "e1",
        programKey: "cogic-stream-2026",
        eventSlug: "a",
        eventType: "main_service",
        title: "Alpha",
        description: null,
        status: "scheduled",
        timezone: "America/Chicago",
        localDate: "2026-11-10",
        scheduledStartAt: "2026-11-10T19:00:00-06:00",
        estimatedStartAt: null,
        scheduledEndAt: null,
        venueLabel: null,
        followsOccurrenceId: null,
        startMode: "fixed",
        broadcastStateId: null,
        replayRecordingId: null,
        eventSortOrder: 1,
      },
    ] satisfies PublishedOccurrence[]);

    assert.deepEqual(
      sorted.map((item) => item.occurrenceId),
      ["1", "2"],
    );
  });
});
