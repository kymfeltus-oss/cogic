import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildDevManifestFallbackPayload,
  DEV_MANIFEST_FALLBACK_HLS,
  isDemoManifestPlaybackUrl,
} from "@/lib/live/manifest-dev-fallback";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("development stream helper isolation", () => {
  it("never returns mux demo when suppressDemoFallback is set", () => {
    const previous = process.env.ENABLE_DEV_MANIFEST_FALLBACK;
    process.env.ENABLE_DEV_MANIFEST_FALLBACK = "1";
    try {
      const payload = buildDevManifestFallbackPayload("main_stage", "unit-test", {
        suppressDemoFallback: true,
      });
      assert.equal(payload, null);
    } finally {
      if (previous === undefined) delete process.env.ENABLE_DEV_MANIFEST_FALLBACK;
      else process.env.ENABLE_DEV_MANIFEST_FALLBACK = previous;
    }
  });

  it("detects demo playback URLs", () => {
    assert.equal(isDemoManifestPlaybackUrl(DEV_MANIFEST_FALLBACK_HLS), true);
    assert.equal(isDemoManifestPlaybackUrl("https://cdn.example/live.m3u8"), false);
  });

  it("rejects mux demo when configured as ATTENDEE_PLAYBACK_HLS_URL", async () => {
    const previous = process.env.ATTENDEE_PLAYBACK_HLS_URL;
    process.env.ATTENDEE_PLAYBACK_HLS_URL = DEV_MANIFEST_FALLBACK_HLS;
    try {
      const { resolveConfiguredAttendeePlaybackFromEnv, resolveAttendeePlaybackFromEnv } =
        await import("@/lib/live/manifest-dev-fallback");
      assert.equal(resolveConfiguredAttendeePlaybackFromEnv(), null);
      assert.equal(resolveAttendeePlaybackFromEnv(), null);
    } finally {
      if (previous === undefined) delete process.env.ATTENDEE_PLAYBACK_HLS_URL;
      else process.env.ATTENDEE_PLAYBACK_HLS_URL = previous;
    }
  });

  it("attendee manifest route never uses demo/env offline fallback helpers", () => {
    const route = fs.readFileSync(
      path.join(root, "app/api/stream/manifest/route.ts"),
      "utf8",
    );
    assert.doesNotMatch(route, /buildDevManifestFallbackPayload/);
    assert.doesNotMatch(route, /ENABLE_DEV_MANIFEST_FALLBACK/);
    assert.match(route, /Stream is offline or no HLS playback URL is configured/);
  });

  it("authoritative live resolver does not import the mux demo URL", () => {
    const authoritative = fs.readFileSync(
      path.join(root, "lib/live/authoritative-state.ts"),
      "utf8",
    );
    assert.doesNotMatch(authoritative, /test-streams\.mux\.dev|DEV_MANIFEST_FALLBACK_HLS/);
  });
});
