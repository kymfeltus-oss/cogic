import type { EventCountdownConfig } from "@/lib/live/countdown-config";
import type {
  FeedState,
  GoLiveRequestBody,
  PreflightCheck,
  PublishMode,
  EventPhaseState,
  SwitchFeedRequestBody,
} from "@/lib/owner/contracts";
import type { HlsProbeResult } from "@/lib/owner/hls-readiness";
import type { OwnerStreamStateRow } from "@/lib/owner/load-owner-state";

import type { VmixSnapshot } from "@/lib/owner/vmix/client";

type BuildPreflightInput = {
  eventPhase: EventPhaseState;
  countdownConfig: EventCountdownConfig;
  streamState: OwnerStreamStateRow | null;
  hlsProbe: HlsProbeResult;
  requestedMode?: PublishMode;
  vmix?: VmixSnapshot | null;
  feed?: FeedState;
};

function feedLaneChecks(feed: FeedState | undefined): PreflightCheck[] {
  if (!feed) {
    return [
      {
        id: "feed_primary",
        label: "Primary feed (Restream) configured",
        status: "skipped",
      },
      {
        id: "feed_backup",
        label: "Backup feed (IVS) configured",
        status: "skipped",
      },
    ];
  }

  return [
    {
      id: "feed_primary",
      label: "Primary feed (Restream) HLS",
      status: feed.primary.hlsUrl ? (feed.primary.manifestReachable ? "pass" : "warn") : "fail",
      detail:
        feed.primary.detail ??
        (feed.primary.hlsUrl
          ? feed.primary.manifestReachable
            ? "Primary manifest validated."
            : "Primary URL set but manifest not reachable."
          : "Set ATTENDEE_PLAYBACK_HLS_URL."),
    },
    {
      id: "feed_backup",
      label: "Backup feed (IVS) HLS",
      status: feed.backup.hlsUrl ? (feed.backup.manifestReachable ? "pass" : "warn") : "warn",
      detail:
        feed.backup.detail ??
        (feed.backup.hlsUrl
          ? feed.backup.manifestReachable
            ? "Backup manifest validated."
            : "Backup URL set but manifest not reachable."
          : "Set ATTENDEE_BACKUP_HLS_URL for hot standby."),
    },
    {
      id: "feed_active",
      label: "Active transmission route",
      status: feed.activeSource === "offline" ? "skipped" : "pass",
      detail:
        feed.activeSource === "offline"
          ? "Not on air."
          : feed.activeSource === "backup"
            ? "Attendees routed to backup (IVS)."
            : "Attendees routed to primary (Restream).",
    },
  ];
}

function scheduleCheck(input: BuildPreflightInput): PreflightCheck {
  const { eventPhase, countdownConfig } = input;

  if (!countdownConfig.is_active) {
    return {
      id: "schedule_active",
      label: "Countdown schedule active",
      status: "warn",
      detail: "No active countdown config — event phase may be idle.",
    };
  }

  if (!eventPhase.startTime || !eventPhase.endTime) {
    return {
      id: "schedule_times",
      label: "Go-live and end times configured",
      status: "fail",
      detail: "Start and end times are required.",
    };
  }

  if (new Date(eventPhase.endTime).getTime() <= new Date(eventPhase.startTime).getTime()) {
    return {
      id: "schedule_times",
      label: "Go-live and end times configured",
      status: "fail",
      detail: "Show end must be after go-live time.",
    };
  }

  return {
    id: "schedule_times",
    label: "Go-live and end times configured",
    status: "pass",
    detail: `${eventPhase.startTime} → ${eventPhase.endTime}`,
  };
}

function hlsChecks(hlsProbe: HlsProbeResult, mode: PublishMode | undefined): PreflightCheck[] {
  if (mode === "browser_camera") {
    return [
      {
        id: "hls_url",
        label: "Public HLS manifest (optional for direct camera)",
        status: hlsProbe.hlsUrl ? "pass" : "skipped",
        detail: hlsProbe.hlsUrl ?? "Direct camera mode uses WebRTC, not HLS.",
      },
    ];
  }

  const checks: PreflightCheck[] = [
    {
      id: "hls_env",
      label: "HLS URL configured",
      status: hlsProbe.hlsUrl ? "pass" : "fail",
      detail: hlsProbe.hlsUrl ?? "Set ATTENDEE_PLAYBACK_HLS_URL or playback_url in live_stream_state.",
    },
    {
      id: "hls_manifest",
      label: "HLS manifest reachable",
      status: hlsProbe.manifestReachable ? "pass" : hlsProbe.hlsUrl ? "warn" : "skipped",
      detail: hlsProbe.detail ?? (hlsProbe.manifestReachable ? "Manifest validated." : undefined),
    },
  ];

  return checks;
}

function cameraSessionCheck(
  streamState: OwnerStreamStateRow | null,
  mode: PublishMode | undefined,
): PreflightCheck {
  if (mode !== "browser_camera") {
    return {
      id: "camera_session",
      label: "Browser camera publisher session",
      status: "skipped",
    };
  }

  if (streamState?.publisher_session_id && streamState.publisher_channel) {
    return {
      id: "camera_session",
      label: "Browser camera publisher session",
      status: "pass",
      detail: `Session ${streamState.publisher_session_id}`,
    };
  }

  return {
    id: "camera_session",
    label: "Browser camera publisher session",
    status: "fail",
    detail: "Start a publisher session from /owner/publish/camera before go-live.",
  };
}

function vmixChecks(mode: PublishMode | undefined, vmix: VmixSnapshot | null | undefined): PreflightCheck[] {
  if (mode !== "rtmp_encoder") {
    return [
      {
        id: "vmix_api",
        label: "vMix API (rtmp_encoder mode only)",
        status: "skipped",
      },
    ];
  }

  if (!vmix?.configured) {
    return [
      {
        id: "vmix_api",
        label: "vMix API configured",
        status: "warn",
        detail: "Set VMIX_API_BASE_URL on the Next server that can reach the vMix PC.",
      },
    ];
  }

  if (vmix.connection !== "reachable") {
    return [
      {
        id: "vmix_api",
        label: "vMix API reachable",
        status: "fail",
        detail: vmix.message ?? "Cannot reach vMix.",
      },
    ];
  }

  return [
    {
      id: "vmix_api",
      label: "vMix API reachable",
      status: "pass",
      detail: vmix.version ? `vMix ${vmix.version}` : "Connected",
    },
    {
      id: "vmix_streaming",
      label: "vMix streaming to Restream",
      status: vmix.streaming ? "pass" : "warn",
      detail: vmix.streaming
        ? "vMix reports streaming active."
        : "Not streaming yet — Go Live (RTMP) will send StartStreaming.",
    },
  ];
}

export function buildPreflightChecks(input: BuildPreflightInput): PreflightCheck[] {
  const mode = input.requestedMode ?? input.streamState?.publish_mode ?? "none";

  return [
    scheduleCheck(input),
    ...hlsChecks(input.hlsProbe, mode),
    ...feedLaneChecks(input.feed),
    ...vmixChecks(mode, input.vmix),
    cameraSessionCheck(input.streamState, mode),
    {
      id: "stream_state_row",
      label: "Platform stream state row",
      status: input.streamState ? "pass" : "fail",
      detail: input.streamState ? `Row ${input.streamState.id}` : "live_stream_state missing.",
    },
  ];
}

export function preflightHasBlockers(checks: PreflightCheck[]): boolean {
  return checks.some((check) => check.status === "fail");
}

export function parseGoLiveBody(body: unknown): GoLiveRequestBody | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const mode = record.mode;

  if (mode !== "external_hls" && mode !== "rtmp_encoder" && mode !== "browser_camera") {
    return null;
  }

  return {
    mode,
    confirm: record.confirm === true,
  };
}

export function parseSwitchFeedBody(body: unknown): SwitchFeedRequestBody | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const source = record.source;

  if (source !== "primary" && source !== "backup") {
    return null;
  }

  return {
    source,
    confirm: record.confirm === true,
  };
}
