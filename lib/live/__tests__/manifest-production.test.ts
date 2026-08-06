import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDevManifestFallbackPayload } from "@/lib/live/manifest-dev-fallback";
import { resolveAuthoritativeLiveState } from "@/lib/live/authoritative-state";

describe("production manifest honesty", () => {
  it("never returns a development stream when fallback suppression is enabled", () => {
    const payload = buildDevManifestFallbackPayload("main_stage", "missing-config", {
      suppressDemoFallback: true,
    });
    assert.equal(payload, null);
  });

  it("requires a published live occurrence and active provider state", () => {
    const occurrence = { status: "live" } as never;
    const stream = { is_live: true, active_source: "primary", playback_url: "https://live.example/stream.m3u8" } as never;
    assert.equal(resolveAuthoritativeLiveState(occurrence, stream), "live");
    assert.equal(resolveAuthoritativeLiveState(occurrence, { ...stream, is_live: false }), "stream_unavailable");
    assert.equal(resolveAuthoritativeLiveState(null, stream), "offline");
  });
});
