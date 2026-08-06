import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  CREDENTIAL_SESSION_MAX_AGE_SECONDS,
  createCredentialSessionValue,
  credentialSessionValuesEqual,
  readCredentialSessionValue,
} from "@/lib/credentials/session-crypto";

const SAMPLE = {
  status: "active" as const,
  badgeCode: "CS26-A1B2C3D4",
  firstName: "Jordan",
  churchName: "Temple of Hope",
  jurisdiction: "Texas Southwest",
  programKey: "cogic-stream-2026",
};

const TEST_SECRET = "test-only-credential-session-secret-value";

describe("credential session cookie crypto", () => {
  beforeEach(() => {
    process.env.COGIC_CREDENTIAL_SESSION_SECRET = TEST_SECRET;
  });

  it("roundtrips allowlisted payload without raw token fields", () => {
    const now = Date.now();
    const value = createCredentialSessionValue(SAMPLE, TEST_SECRET, now);
    const parsed = readCredentialSessionValue(value, TEST_SECRET, now);
    assert.deepEqual(parsed, SAMPLE);
    assert.equal(value.includes("token"), false);
  });

  it("rejects expired sessions", () => {
    const now = Date.now();
    const value = createCredentialSessionValue(SAMPLE, TEST_SECRET, now);
    const later = now + (CREDENTIAL_SESSION_MAX_AGE_SECONDS + 5) * 1000;
    assert.equal(readCredentialSessionValue(value, TEST_SECRET, later), null);
  });

  it("rejects tampered ciphertext", () => {
    const value = createCredentialSessionValue(SAMPLE, TEST_SECRET);
    const tampered = `${value.slice(0, -1)}X`;
    assert.equal(readCredentialSessionValue(tampered, TEST_SECRET), null);
  });

  it("rejects malformed cookie values", () => {
    assert.equal(readCredentialSessionValue("", TEST_SECRET), null);
    assert.equal(readCredentialSessionValue("not-valid", TEST_SECRET), null);
  });

  it("compares values in constant time helper", () => {
    assert.equal(credentialSessionValuesEqual("abc", "abc"), true);
    assert.equal(credentialSessionValuesEqual("abc", "abd"), false);
    assert.equal(credentialSessionValuesEqual("abc", "abcd"), false);
  });
});
