import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashRateLimitIdentifier } from "@/lib/rate-limit/hash";

describe("rate-limit hash", () => {
  it("hashes identifiers stably without leaking the source value", () => {
    const token = "abcdefghijklmnopqrstuvwxyz0123456789ABCDE_-";
    const hashed = hashRateLimitIdentifier(token);
    assert.equal(hashed.length, 32);
    assert.equal(hashed.includes(token), false);
    assert.equal(hashRateLimitIdentifier(token), hashed);
  });
});
