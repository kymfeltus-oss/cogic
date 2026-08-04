import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertRegistrationStatusTransition,
  canTransitionRegistrationStatus,
  isActiveRegistrationStatus,
  isTerminalRegistrationStatus,
  listAllowedRegistrationTransitions,
} from "@/lib/registration/status";

describe("registration status transitions", () => {
  it("allows the approved lifecycle edges", () => {
    assert.equal(canTransitionRegistrationStatus("draft", "submitted"), true);
    assert.equal(canTransitionRegistrationStatus("draft", "canceled"), true);
    assert.equal(canTransitionRegistrationStatus("submitted", "payment_pending"), true);
    assert.equal(canTransitionRegistrationStatus("submitted", "confirmed"), true);
    assert.equal(canTransitionRegistrationStatus("submitted", "canceled"), true);
    assert.equal(canTransitionRegistrationStatus("payment_pending", "confirmed"), true);
    assert.equal(canTransitionRegistrationStatus("payment_pending", "submitted"), true);
    assert.equal(canTransitionRegistrationStatus("payment_pending", "canceled"), true);
    assert.equal(canTransitionRegistrationStatus("confirmed", "refunded"), true);
  });

  it("rejects confirmed → canceled and refunded → confirmed", () => {
    assert.equal(canTransitionRegistrationStatus("confirmed", "canceled"), false);
    assert.equal(canTransitionRegistrationStatus("refunded", "confirmed"), false);
    assert.equal(canTransitionRegistrationStatus("canceled", "draft"), false);
    assert.equal(canTransitionRegistrationStatus("refunded", "draft"), false);
  });

  it("treats canceled and refunded as terminal", () => {
    assert.equal(isTerminalRegistrationStatus("canceled"), true);
    assert.equal(isTerminalRegistrationStatus("refunded"), true);
    assert.equal(isTerminalRegistrationStatus("confirmed"), false);
    assert.deepEqual(listAllowedRegistrationTransitions("canceled"), []);
    assert.deepEqual(listAllowedRegistrationTransitions("refunded"), []);
  });

  it("identifies active statuses for duplicate protection", () => {
    assert.equal(isActiveRegistrationStatus("draft"), true);
    assert.equal(isActiveRegistrationStatus("confirmed"), true);
    assert.equal(isActiveRegistrationStatus("canceled"), false);
    assert.equal(isActiveRegistrationStatus("refunded"), false);
  });

  it("assertRegistrationStatusTransition throws on invalid edges", () => {
    assert.doesNotThrow(() =>
      assertRegistrationStatusTransition("draft", "submitted"),
    );
    assert.throws(
      () => assertRegistrationStatusTransition("confirmed", "canceled"),
      /Invalid registration status transition/,
    );
  });
});
