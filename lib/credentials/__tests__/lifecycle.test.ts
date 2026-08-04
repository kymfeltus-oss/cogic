import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCredentialStatusTransition,
  canTransitionCredentialStatus,
  isCredentialExpiredAt,
  isTerminalCredentialStatus,
  isUsableCredentialStatus,
} from "@/lib/credentials/lifecycle";

describe("credential lifecycle", () => {
  it("allows issued → active and usable statuses", () => {
    assert.equal(canTransitionCredentialStatus("issued", "active"), true);
    assert.equal(isUsableCredentialStatus("issued"), true);
    assert.equal(isUsableCredentialStatus("active"), true);
  });

  it("allows active → rotated/revoked/expired", () => {
    assert.equal(canTransitionCredentialStatus("active", "rotated"), true);
    assert.equal(canTransitionCredentialStatus("active", "revoked"), true);
    assert.equal(canTransitionCredentialStatus("active", "expired"), true);
  });

  it("denies reactivation from terminal statuses", () => {
    for (const terminal of ["rotated", "revoked", "expired"] as const) {
      assert.equal(isTerminalCredentialStatus(terminal), true);
      assert.equal(canTransitionCredentialStatus(terminal, "active"), false);
      assert.equal(canTransitionCredentialStatus(terminal, "issued"), false);
      assert.throws(
        () => assertCredentialStatusTransition(terminal, "active"),
        /Invalid credential status transition/,
      );
    }
  });

  it("treats expires_at <= now as expired without waiting for status update", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    assert.equal(isCredentialExpiredAt(past), true);
    assert.equal(isCredentialExpiredAt(future), false);
    assert.equal(isCredentialExpiredAt(null), false);
  });
});
