import assert from "node:assert/strict";
import test from "node:test";
import type { FeedState, IngestProfileStatus } from "@/lib/owner/contracts";
import { buildPreflightChecks, preflightHasBlockers } from "@/lib/owner/preflight";
import { detectBroadcastProvider, isProductionPlaybackUrl, resolveSafeIngestProfile } from "@/lib/owner/provider-config";

const IVS_URL = "https://example.us-east-1.playback.live-video.net/api/video/v1/us-east-1.123.channel.m3u8";

function feed(primaryUrl: string | null, backupUrl: string | null = null): FeedState {
  return {
    activeSource: "offline",
    primary: { provider: primaryUrl ? detectBroadcastProvider(primaryUrl) : "ivs", hlsUrl: primaryUrl, manifestReachable: false, detail: null },
    backup: { provider: "external", hlsUrl: backupUrl, manifestReachable: false, detail: null },
  };
}

function ingest(playbackConfigured = true): IngestProfileStatus {
  return { provider: "ivs", protocol: "rtmps", ingestConfigured: true, playbackConfigured, channelConfigured: true, recordingConfigured: true, recordingActive: false, backupConfigured: false, crewConnectionReady: playbackConfigured };
}

function checks(primaryUrl: string | null, options: { devFallback?: boolean; mode?: "external_hls" | "rtmp_encoder" } = {}) {
  return buildPreflightChecks({
    eventPhase: { phase: "idle", startTime: null, endTime: null, scheduleTimezone: null },
    countdownConfig: { is_active: false } as never,
    streamState: { id: "global", publish_mode: options.mode ?? "external_hls" } as never,
    hlsProbe: { envConfigured: Boolean(primaryUrl), hlsUrl: primaryUrl, manifestReachable: false, detail: null },
    requestedMode: options.mode ?? "external_hls",
    provider: "ivs",
    ingest: ingest(Boolean(primaryUrl)),
    feed: feed(primaryUrl),
    production: true,
    devFallbackEnabled: options.devFallback ?? false,
    vmix: null,
  });
}

test("IVS configured without Restream passes required configuration checks", () => {
  const result = checks(IVS_URL);
  assert.equal(preflightHasBlockers(result), false);
  assert.equal(result.find((item) => item.id === "feed_primary")?.provider, "ivs");
});

test("IVS configured without vMix passes because vMix is optional", () => {
  const result = checks(IVS_URL, { mode: "rtmp_encoder" });
  const vmix = result.find((item) => item.id === "vmix_api");
  assert.equal(vmix?.required, false);
  assert.equal(preflightHasBlockers(result), false);
});

test("missing primary IVS URL blocks", () => assert.equal(preflightHasBlockers(checks(null)), true));
test("Mux demo URL is rejected", () => assert.equal(isProductionPlaybackUrl("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"), false));
test("real HTTPS IVS URL is production-safe", () => assert.equal(isProductionPlaybackUrl(IVS_URL), true));
test("absent backup does not block", () => assert.equal(checks(IVS_URL).find((item) => item.id === "feed_backup")?.required, false));
test("development fallback enabled in production blocks", () => assert.equal(preflightHasBlockers(checks(IVS_URL, { devFallback: true })), true));
test("Restream is not required when provider is IVS", () => assert.equal(checks(IVS_URL).some((item) => /Restream/.test(item.label)), false));
test("optional failure does not block", () => assert.equal(preflightHasBlockers([{ id: "optional", label: "Optional", status: "fail", required: false }]), false));
test("required failure blocks", () => assert.equal(preflightHasBlockers([{ id: "required", label: "Required", status: "fail", required: true }]), true));

function withIvsEnv(values: Record<string, string | undefined>, run: () => void) {
  const keys = Object.keys(values);
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) value === undefined ? delete process.env[key] : process.env[key] = value;
  try { run(); } finally {
    for (const [key, value] of Object.entries(before)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
}

test("RTMPS selection is ready without SRT configuration", () => withIvsEnv({
  BROADCAST_PRIMARY_PROVIDER: "ivs", AWS_IVS_INGEST_PROTOCOL: "rtmps",
  AWS_IVS_INGEST_SERVER: "configured", AWS_IVS_STREAM_KEY: "secret",
  AWS_IVS_SRT_ENDPOINT: undefined, AWS_IVS_SRT_PASSPHRASE: undefined,
}, () => assert.equal(resolveSafeIngestProfile(IVS_URL, null).protocol, "rtmps")));

test("missing RTMPS stream key blocks ingest readiness", () => withIvsEnv({
  BROADCAST_PRIMARY_PROVIDER: "ivs", AWS_IVS_INGEST_PROTOCOL: "rtmps",
  AWS_IVS_INGEST_SERVER: "configured", AWS_IVS_STREAM_KEY: undefined,
}, () => assert.equal(resolveSafeIngestProfile(IVS_URL, null).ingestConfigured, false)));

test("selected SRT requires its complete profile", () => withIvsEnv({
  BROADCAST_PRIMARY_PROVIDER: "ivs", AWS_IVS_INGEST_PROTOCOL: "srt",
  AWS_IVS_SRT_ENDPOINT: "configured", AWS_IVS_SRT_PORT: "9000",
  AWS_IVS_SRT_STREAM_ID: "configured", AWS_IVS_SRT_PASSPHRASE: undefined,
  AWS_IVS_INGEST_SERVER: "configured", AWS_IVS_STREAM_KEY: "secret",
}, () => assert.equal(resolveSafeIngestProfile(IVS_URL, null).ingestConfigured, false)));

test("recording configured remains inactive while encoder is offline", () => withIvsEnv({
  BROADCAST_PRIMARY_PROVIDER: "ivs", AWS_IVS_RECORDING_ENABLED: "true",
}, () => {
  const profile = resolveSafeIngestProfile(IVS_URL, null, false);
  assert.equal(profile.recordingConfigured, true);
  assert.equal(profile.recordingActive, false);
}));
