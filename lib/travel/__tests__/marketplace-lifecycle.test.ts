import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertMarketplaceTransition,
  isStaleMarketplaceAttempt,
} from "../marketplace/lifecycle";

describe("marketplace booking lifecycle", () => {
  it("allows valid transitions and rejects confirmation from failed/refunded", () => {
    assert.doesNotThrow(() => assertMarketplaceTransition("DRAFT", "PAYMENT_PENDING"));
    assert.doesNotThrow(() => assertMarketplaceTransition("PAYMENT_PENDING", "SUPPLIER_SUBMITTED"));
    assert.doesNotThrow(() => assertMarketplaceTransition("SUPPLIER_SUBMITTED", "CONFIRMED"));
    assert.doesNotThrow(() => assertMarketplaceTransition("SUPPLIER_SUBMITTED", "REFUNDED"));
    assert.throws(() => assertMarketplaceTransition("FAILED", "CONFIRMED"));
    assert.throws(() => assertMarketplaceTransition("REFUNDED", "CONFIRMED"));
    assert.throws(() => assertMarketplaceTransition("CONFIRMED", "PAYMENT_PENDING"));
  });

  it("detects stale non-final attempts without labeling them failed", () => {
    const now = Date.UTC(2026, 7, 10, 12);
    const stale = {
      status: "SUPPLIER_SUBMITTED" as const,
      started_at: new Date(now - 25 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 25 * 60 * 60 * 1000).toISOString(),
    };
    const fresh = {
      status: "PAYMENT_PENDING" as const,
      started_at: new Date(now - 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 60 * 60 * 1000).toISOString(),
    };
    assert.equal(isStaleMarketplaceAttempt(stale, now), true);
    assert.equal(isStaleMarketplaceAttempt(fresh, now), false);
    assert.equal(
      isStaleMarketplaceAttempt({ ...stale, status: "CONFIRMED" }, now),
      false,
    );
  });
});
