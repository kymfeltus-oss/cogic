import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  CREDENTIAL_HASH_BYTE_LENGTH,
  CREDENTIAL_TOKEN_CHAR_LENGTH,
  credentialTokenHashHex,
  generateBadgeCode,
  generateCredentialToken,
  hashCredentialToken,
  isValidCredentialToken,
} from "@/lib/credentials/token";
import { BADGE_CODE_PATTERN } from "@/lib/credentials/types";
import type { SafeCredentialResolution } from "@/lib/credentials/types";

describe("credential token crypto", () => {
  it("generates exactly 43 URL-safe characters", () => {
    const token = generateCredentialToken();
    assert.equal(token.length, CREDENTIAL_TOKEN_CHAR_LENGTH);
    assert.equal(isValidCredentialToken(token), true);
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  });

  it("produces unique tokens across a sample", () => {
    const set = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      set.add(generateCredentialToken());
    }
    assert.equal(set.size, 50);
  });

  it("rejects malformed and oversized tokens", () => {
    assert.equal(isValidCredentialToken(""), false);
    assert.equal(isValidCredentialToken("abc"), false);
    assert.equal(isValidCredentialToken("a".repeat(42)), false);
    assert.equal(isValidCredentialToken("a".repeat(44)), false);
    assert.equal(isValidCredentialToken("!".repeat(43)), false);
    assert.equal(isValidCredentialToken("a".repeat(100)), false);
    assert.throws(() => hashCredentialToken("not-valid"), /Invalid credential token/);
  });

  it("hashes deterministically to exactly 32 bytes", () => {
    const token = generateCredentialToken();
    const a = hashCredentialToken(token);
    const b = hashCredentialToken(token);
    assert.equal(a.length, CREDENTIAL_HASH_BYTE_LENGTH);
    assert.deepEqual(a, b);
    assert.equal(
      a.toString("hex"),
      createHash("sha256").update(token, "utf8").digest("hex"),
    );
    assert.equal(credentialTokenHashHex(token).length, 64);
  });

  it("generates non-secret badge codes in documented format", () => {
    const code = generateBadgeCode();
    assert.match(code, BADGE_CODE_PATTERN);
  });

  it("safe DTO shape excludes token and hash fields", () => {
    const dto: SafeCredentialResolution = {
      outcome: "resolved",
      status: "active",
      badgeCode: "CS26-A1B2C3D4",
      firstName: "Test",
      churchName: "Temple",
      jurisdiction: "IL",
      programKey: "cogic-stream-2026",
    };
    const keys = Object.keys(dto);
    assert.equal(keys.includes("token"), false);
    assert.equal(keys.includes("rawToken"), false);
    assert.equal(keys.includes("tokenHash"), false);
    assert.equal(keys.includes("registrationId"), false);
    assert.equal(keys.includes("credentialId"), false);
    assert.equal(keys.includes("email"), false);
  });
});
