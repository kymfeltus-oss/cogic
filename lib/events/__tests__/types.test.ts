import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isEventType,
  parseEventType,
  DEFAULT_PROGRAM_KEY,
} from "../types.ts";

describe("event type validation", () => {
  it("accepts 2026 event types and rejects unknown", () => {
    assert.equal(isEventType("main_service"), true);
    assert.equal(isEventType("revival_fire"), true);
    assert.equal(isEventType("midnight_musical"), true);
    assert.equal(isEventType("main_event_center_class"), true);
    assert.equal(isEventType("worship"), false);
    assert.equal(parseEventType("midnight_musical"), "midnight_musical");
    assert.throws(() => parseEventType("revival"));
  });

  it("keeps Midnight Musical distinct from Revival Fire", () => {
    assert.notEqual(parseEventType("midnight_musical"), parseEventType("revival_fire"));
    assert.equal(DEFAULT_PROGRAM_KEY, "cogic-stream-2026");
  });
});
