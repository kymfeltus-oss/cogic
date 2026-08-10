import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertMarketplaceTransition,
  isStaleMarketplaceAttempt,
  MARKETPLACE_STALE_AFTER_MS,
} from "../marketplace/lifecycle";

describe("marketplace booking lifecycle", () => {
  it("allows valid transitions and rejects confirmation from canceled/failed", () => {
    assert.doesNotThrow(() => assertMarketplaceTransition("booking_started", "pending_confirmation"));
    assert.doesNotThrow(() => assertMarketplaceTransition("pending_confirmation", "confirmed"));
    assert.throws(() => assertMarketplaceTransition("canceled", "confirmed"));
    assert.throws(() => assertMarketplaceTransition("failed", "confirmed"));
    assert.throws(() => assertMarketplaceTransition("confirmed", "pending_confirmation"));
  });

  it("detects stale non-final attempts without labeling them failed", () => {
    const now = Date.parse("2026-08-10T12:00:00.000Z");
    const stale = {
      status: "pending_confirmation" as const,
      started_at: "2026-08-08T12:00:00.000Z",
      updated_at: "2026-08-08T12:00:00.000Z",
    };
    const fresh = {
      status: "pending_confirmation" as const,
      started_at: "2026-08-10T11:00:00.000Z",
      updated_at: "2026-08-10T11:00:00.000Z",
    };
    assert.equal(isStaleMarketplaceAttempt(stale, now), true);
    assert.equal(isStaleMarketplaceAttempt(fresh, now), false);
    assert.equal(
      isStaleMarketplaceAttempt({ ...stale, status: "confirmed" }, now),
      false,
    );
    assert.ok(MARKETPLACE_STALE_AFTER_MS >= 24 * 60 * 60 * 1000);
  });
});
