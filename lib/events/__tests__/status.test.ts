import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertEventStatusTransition,
  assertOccurrenceStatusTransition,
  canTransitionEventStatus,
  canTransitionOccurrenceStatus,
} from "../status.ts";

describe("event status lifecycle", () => {
  it("allows draft → published → archived → published", () => {
    assert.equal(canTransitionEventStatus("draft", "published"), true);
    assert.equal(canTransitionEventStatus("published", "archived"), true);
    assert.equal(canTransitionEventStatus("archived", "published"), true);
    assert.equal(canTransitionEventStatus("draft", "archived"), false);
    assert.doesNotThrow(() => assertEventStatusTransition("draft", "published"));
    assert.throws(() => assertEventStatusTransition("draft", "archived"));
  });
});

describe("occurrence status lifecycle", () => {
  it("allows schedule progression and terminal canceled/completed", () => {
    assert.equal(canTransitionOccurrenceStatus("scheduled", "starting_soon"), true);
    assert.equal(canTransitionOccurrenceStatus("scheduled", "next"), true);
    assert.equal(canTransitionOccurrenceStatus("next", "live"), true);
    assert.equal(canTransitionOccurrenceStatus("live", "completed"), true);
    assert.equal(canTransitionOccurrenceStatus("completed", "live"), false);
    assert.equal(canTransitionOccurrenceStatus("canceled", "scheduled"), false);
    assert.doesNotThrow(() => assertOccurrenceStatusTransition("delayed", "live"));
    assert.throws(() => assertOccurrenceStatusTransition("completed", "scheduled"));
  });
});
