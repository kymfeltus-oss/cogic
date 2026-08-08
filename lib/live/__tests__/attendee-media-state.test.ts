import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAttendeeMediaState } from "@/lib/live/attendee-media-state";

describe("attendee media state", () => {
  const replay = { playbackUrl: "https://media.example/replay.m3u8" };

  it("shows LIVE NOW and WATCH LIVE for an active stream", () => {
    assert.deepEqual(resolveAttendeeMediaState(true, null), {
      kind: "live", badge: "LIVE NOW", cta: "WATCH LIVE",
    });
  });

  it("shows PLAYING NOW and WATCH NOW for a playable published replay", () => {
    assert.deepEqual(resolveAttendeeMediaState(false, replay), {
      kind: "replay", badge: "PLAYING NOW", cta: "WATCH NOW",
    });
  });

  it("treats the curated service preview as playable fallback media", () => {
    assert.deepEqual(resolveAttendeeMediaState(false, null, true), {
      kind: "replay", badge: "PLAYING NOW", cta: "WATCH NOW",
    });
    assert.equal(resolveAttendeeMediaState(true, null, true).kind, "live");
  });

  it("shows OFFLINE without a CTA when no media is playable", () => {
    assert.deepEqual(resolveAttendeeMediaState(false, null), {
      kind: "offline", badge: "OFFLINE", cta: null,
    });
    assert.equal(resolveAttendeeMediaState(false, { playbackUrl: "  " }).kind, "offline");
  });

  it("gives live priority over a replay and falls back after live ends", () => {
    assert.equal(resolveAttendeeMediaState(true, replay).kind, "live");
    assert.equal(resolveAttendeeMediaState(false, replay).kind, "replay");
  });
});
