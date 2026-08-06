import type { EventCountdownConfig } from "@/lib/live/countdown-config";
import type {
  BroadcastProvider,
  EventPhaseState,
  FeedState,
  GoLiveRequestBody,
  IngestProfileStatus,
  PreflightCheck,
  PublishMode,
  SwitchFeedRequestBody,
} from "@/lib/owner/contracts";
import type { HlsProbeResult } from "@/lib/owner/hls-readiness";
import type { OwnerStreamStateRow } from "@/lib/owner/load-owner-state";
import type { VmixSnapshot } from "@/lib/owner/vmix/client";
import { isProviderPlaybackConsistent } from "@/lib/owner/provider-config";

export type BuildPreflightInput = {
  eventPhase: EventPhaseState;
  countdownConfig: EventCountdownConfig;
  streamState: OwnerStreamStateRow | null;
  hlsProbe: HlsProbeResult;
  requestedMode?: PublishMode;
  provider?: BroadcastProvider;
  ingest?: IngestProfileStatus;
  vmix?: VmixSnapshot | null;
  vmixRequired?: boolean;
  feed?: FeedState;
  production?: boolean;
  devFallbackEnabled?: boolean;
};

function check(input: Omit<PreflightCheck, "required"> & { required?: boolean }): PreflightCheck {
  return { required: input.required ?? false, ...input };
}

function feedChecks(feed: FeedState | undefined, provider: BroadcastProvider): PreflightCheck[] {
  if (!feed) {
    return [check({ id: "feed_primary", label: "Primary provider configured", status: "fail", required: true, provider })];
  }

  const primaryConfigured = isProviderPlaybackConsistent(provider, feed.primary.hlsUrl);
  return [
    check({
      id: "feed_primary",
      label: `Primary feed (${provider === "ivs" ? "Amazon IVS" : provider})`,
      status: primaryConfigured ? "pass" : "fail",
      required: true,
      provider,
      detail: primaryConfigured
        ? `${provider === "ivs" ? "Amazon IVS" : provider} production playback is configured.`
        : `Configure a production-safe playback URL consistent with provider ${provider}.`,
    }),
    check({
      id: "feed_backup",
      label: "Backup feed",
      status: feed.backup.hlsUrl ? "pass" : "warn",
      detail: feed.backup.hlsUrl ? "Real backup playback is configured." : "UNCONFIGURED — no fake redundancy is used.",
    }),
    check({
      id: "feed_active",
      label: "Active transmission route",
      status: feed.activeSource === "offline" ? "skipped" : "pass",
      detail: feed.activeSource === "offline" ? "Stream is offline." : `Attendees are routed to the ${feed.activeSource} feed.`,
    }),
  ];
}

function scheduleCheck(input: BuildPreflightInput): PreflightCheck {
  const { eventPhase, countdownConfig } = input;
  if (!countdownConfig.is_active || !eventPhase.startTime || !eventPhase.endTime) {
    return check({ id: "schedule_active", label: "Published occurrence / schedule", status: "warn", detail: "No complete active schedule; this does not block configuration readiness." });
  }
  if (new Date(eventPhase.endTime).getTime() <= new Date(eventPhase.startTime).getTime()) {
    return check({ id: "schedule_times", label: "Schedule times", status: "warn", detail: "Show end must be after go-live time." });
  }
  return check({ id: "schedule_times", label: "Schedule times", status: "pass", detail: "Start and end times are configured." });
}

function hlsChecks(hlsProbe: HlsProbeResult, mode: PublishMode | undefined): PreflightCheck[] {
  if (mode === "browser_camera") {
    return [check({ id: "hls_env", label: "Production HLS playback", status: hlsProbe.hlsUrl ? "pass" : "skipped", detail: "Optional in browser camera mode." })];
  }
  return [
    check({
      id: "hls_env",
      label: "Production HLS playback configured",
      status: hlsProbe.hlsUrl ? "pass" : "fail",
      required: true,
      detail: hlsProbe.hlsUrl ? "Approved HTTPS HLS playback is configured." : "Set ATTENDEE_PLAYBACK_HLS_URL or approved database primary_playback_url.",
    }),
    check({
      id: "hls_manifest",
      label: "Stream currently reachable",
      status: hlsProbe.manifestReachable ? "pass" : hlsProbe.hlsUrl ? "warn" : "skipped",
      detail: hlsProbe.manifestReachable ? "Manifest is online." : "Configuration may be ready while the encoder is offline.",
    }),
  ];
}

function ingestChecks(ingest: IngestProfileStatus | undefined, mode: PublishMode | undefined): PreflightCheck[] {
  if (!ingest) return [];
  const required = mode === "rtmp_encoder";
  return [
    check({
      id: "channel_primary",
      label: "Amazon IVS channel",
      status: ingest.channelConfigured ? "pass" : required ? "fail" : "warn",
      required,
      provider: ingest.provider,
      detail: ingest.channelConfigured ? "Channel metadata is configured server-side." : "Configure the IVS channel name and ARN.",
    }),
    check({
      id: "ingest_primary",
      label: "Professional crew ingest profile",
      status: ingest.ingestConfigured ? "pass" : required ? "fail" : "warn",
      required,
      provider: ingest.provider,
      detail: ingest.ingestConfigured
        ? `${ingest.protocol.toUpperCase()} contribution is configured; credentials remain server-only.`
        : "Configure an approved IVS RTMPS or SRT contribution path before encoder go-live.",
    }),
    check({ id: "recording", label: "Recording configuration", status: ingest.recordingConfigured ? "pass" : "warn", detail: ingest.recordingConfigured ? "RECORDING_CONFIGURED; active recording requires a live provider stream." : "Recording is not confirmed." }),
  ];
}

function vmixChecks(mode: PublishMode | undefined, vmix: VmixSnapshot | null | undefined, required: boolean): PreflightCheck[] {
  if (mode !== "rtmp_encoder" || !vmix?.configured) {
    return [check({ id: "vmix_api", label: "vMix integration", status: "skipped", required: false, detail: "NOT_CONFIGURED — vMix is optional and encoder/vendor agnostic." })];
  }
  const reachable = vmix.connection === "reachable";
  return [check({
    id: "vmix_api",
    label: "vMix integration",
    status: reachable ? "pass" : required ? "fail" : "warn",
    required,
    detail: reachable ? "vMix API is reachable." : "Optional vMix API is not reachable.",
  })];
}

export function buildPreflightChecks(input: BuildPreflightInput): PreflightCheck[] {
  const mode = input.requestedMode ?? input.streamState?.publish_mode ?? "none";
  const provider = input.provider ?? input.feed?.primary.provider ?? "external";
  const production = input.production ?? process.env.NODE_ENV === "production";
  const devFallbackEnabled = input.devFallbackEnabled ?? process.env.ENABLE_DEV_MANIFEST_FALLBACK === "true";
  return [
    check({ id: "dev_fallback", label: "Development manifest fallback disabled", status: production && devFallbackEnabled ? "fail" : "pass", required: true, detail: production && devFallbackEnabled ? "Disable ENABLE_DEV_MANIFEST_FALLBACK in production." : "No production demo fallback is enabled." }),
    scheduleCheck(input),
    ...hlsChecks(input.hlsProbe, mode),
    ...feedChecks(input.feed, provider),
    ...ingestChecks(input.ingest, mode),
    ...vmixChecks(mode, input.vmix, input.vmixRequired === true),
    check({ id: "camera_session", label: "Browser camera publisher session", status: mode !== "browser_camera" ? "skipped" : input.streamState?.publisher_session_id && input.streamState.publisher_channel ? "pass" : "fail", required: mode === "browser_camera", detail: mode === "browser_camera" && !input.streamState?.publisher_session_id ? "Start an authorized publisher session first." : undefined }),
    check({ id: "stream_state_row", label: "Platform stream state row", status: input.streamState ? "pass" : "fail", required: true, detail: input.streamState ? "Authoritative live_stream_state is available." : "live_stream_state missing." }),
  ];
}

export function preflightHasBlockers(checks: PreflightCheck[]): boolean {
  return checks.some((item) => item.required && item.status === "fail");
}

export function parseGoLiveBody(body: unknown): GoLiveRequestBody | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (record.mode !== "external_hls" && record.mode !== "rtmp_encoder" && record.mode !== "browser_camera") return null;
  return { mode: record.mode, confirm: record.confirm === true };
}

export function parseSwitchFeedBody(body: unknown): SwitchFeedRequestBody | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (record.source !== "primary" && record.source !== "backup") return null;
  return { source: record.source, confirm: record.confirm === true };
}
