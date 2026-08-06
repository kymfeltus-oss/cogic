import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseOwnerOccurrenceWriteInput,
  occurrenceRowFromWriteInput,
} from "@/lib/events/owner-occurrence-input";

describe("owner occurrence input validation", () => {
  it("requires eventId, localDate, and fixed start time", () => {
    assert.throws(
      () => parseOwnerOccurrenceWriteInput({ localDate: "2026-11-03" }),
      /eventId/i,
    );
    assert.throws(
      () =>
        parseOwnerOccurrenceWriteInput({
          eventId: "11111111-1111-1111-1111-111111111111",
          localDate: "11-03-2026",
          scheduledStartAt: "2026-11-03T19:00:00.000Z",
        }),
      /localDate/i,
    );
    assert.throws(
      () =>
        parseOwnerOccurrenceWriteInput({
          eventId: "11111111-1111-1111-1111-111111111111",
          localDate: "2026-11-03",
          startMode: "fixed",
        }),
      /scheduledStartAt/i,
    );
  });

  it("rejects end before start and defaults unpublished draft visibility", () => {
    assert.throws(
      () =>
        parseOwnerOccurrenceWriteInput({
          eventId: "11111111-1111-1111-1111-111111111111",
          localDate: "2026-11-03",
          scheduledStartAt: "2026-11-03T20:00:00.000Z",
          scheduledEndAt: "2026-11-03T19:00:00.000Z",
        }),
      /scheduledEndAt/i,
    );

    const input = parseOwnerOccurrenceWriteInput({
      eventId: "11111111-1111-1111-1111-111111111111",
      localDate: "2026-11-03",
      scheduledStartAt: "2026-11-03T19:00:00.000Z",
    });
    assert.equal(input.visibility, "unpublished");
    assert.equal(input.status, "scheduled");
    assert.equal(input.startMode, "fixed");
  });

  it("maps write input to snake_case persistence without inventing venue/title", () => {
    const input = parseOwnerOccurrenceWriteInput({
      eventId: "11111111-1111-1111-1111-111111111111",
      localDate: "2026-11-03",
      scheduledStartAt: "2026-11-03T19:00:00.000Z",
      visibility: "published",
    });
    const row = occurrenceRowFromWriteInput(input, "user-1", "create");
    assert.equal(row.event_id, input.eventId);
    assert.equal(row.visibility, "published");
    assert.equal(row.venue_label, null);
    assert.equal(row.title_override, null);
    assert.equal(row.created_by, "user-1");
    assert.equal(row.updated_by, "user-1");
  });
});
