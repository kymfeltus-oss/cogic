import { loadActiveCountdownConfig } from "@/lib/live/fetch-countdown-config";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  ActiveFeedSource,
  FeedLaneState,
  FeedState,
  OwnerBroadcastSnapshot,
  PlaybackState,
  PublishState,
} from "@/lib/owner/contracts";
import { probeHlsManifest } from "@/lib/owner/hls-readiness";
import {
  normalizeActiveFeedSource,
  resolveActiveFeedPlaybackUrl,
  resolveBackupFeedUrl,
  resolvePrimaryFeedUrl,
} from "@/lib/owner/feed-urls";
import { loadOwnerStreamState } from "@/lib/owner/load-owner-state";
import { mapEventPhaseState } from "@/lib/owner/map-event-phase";
import { buildPreflightChecks } from "@/lib/owner/preflight";
import { fetchVmixSnapshot } from "@/lib/owner/vmix/client";

function resolvePublishState(row: Awaited<ReturnType<typeof loadOwnerStreamState>>["row"]): PublishState {
  if (!row) {
    return { mode: "none", status: "offline", errorMessage: null };
  }

  return {
    mode: row.publish_mode ?? "none",
    status: row.publish_status ?? "offline",
    errorMessage: row.publish_error_message,
  };
}

function resolvePlaybackState(
  row: Awaited<ReturnType<typeof loadOwnerStreamState>>["row"],
  hlsUrl: string | null,
  manifestReachable: boolean,
): PlaybackState {
  if (!row) {
    return {
      status: hlsUrl ? "ready" : "unconfigured",
      hlsUrl,
      manifestReachable,
      errorMessage: null,
    };
  }

  let status = row.playback_status ?? "unconfigured";
  if (status === "playback_pending" && manifestReachable && row.is_live) {
    status = "live";
  } else if (status === "unconfigured" && hlsUrl) {
    status = "ready";
  }

  return {
    status,
    hlsUrl,
    manifestReachable,
    errorMessage: row.playback_error_message,
  };
}

function laneFromProbe(
  hlsUrl: string | null,
  probe: Awaited<ReturnType<typeof probeHlsManifest>>,
): FeedLaneState {
  return {
    hlsUrl: probe.hlsUrl ?? hlsUrl,
    manifestReachable: probe.manifestReachable,
    detail: probe.detail,
  };
}

async function buildFeedState(
  row: Awaited<ReturnType<typeof loadOwnerStreamState>>["row"],
): Promise<FeedState> {
  const inputs = {
    primary_playback_url: row?.primary_playback_url,
    backup_playback_url: row?.backup_playback_url,
    playback_url: row?.playback_url,
    active_source: row?.active_source,
    is_live: row?.is_live,
  };

  const primaryUrl = resolvePrimaryFeedUrl(inputs);
  const backupUrl = resolveBackupFeedUrl(inputs);
  const activeSource = normalizeActiveFeedSource(
    row?.active_source,
    row?.is_live === true,
  ) as ActiveFeedSource;

  const [primaryProbe, backupProbe] = await Promise.all([
    probeHlsManifest(primaryUrl),
    probeHlsManifest(backupUrl),
  ]);

  return {
    activeSource,
    primary: laneFromProbe(primaryUrl, primaryProbe),
    backup: laneFromProbe(backupUrl, backupProbe),
  };
}

export async function buildOwnerBroadcastSnapshot(
  requestedMode?: PublishState["mode"],
): Promise<{ snapshot: OwnerBroadcastSnapshot; error: string | null }> {
  const admin = getSupabaseAdmin();
  const [countdownConfig, streamResult, vmix, feed] = await Promise.all([
    loadActiveCountdownConfig(),
    loadOwnerStreamState(admin),
    fetchVmixSnapshot(),
    loadOwnerStreamState(admin).then(async ({ row }) => buildFeedState(row)),
  ]);

  const eventPhase = mapEventPhaseState(countdownConfig);
  const row = streamResult.row;

  const skipHls = requestedMode === "browser_camera";
  const activePlayback = skipHls
    ? { url: null as string | null, activeSource: "offline" as const }
    : resolveActiveFeedPlaybackUrl({
        primary_playback_url: row?.primary_playback_url,
        backup_playback_url: row?.backup_playback_url,
        playback_url: row?.playback_url,
        active_source: row?.active_source,
        is_live: row?.is_live,
      });

  const hlsUrl = skipHls ? null : activePlayback.url;
  const activeLane =
    activePlayback.activeSource === "backup" ? feed.backup : feed.primary;
  const manifestReachable = skipHls ? false : activeLane.manifestReachable;

  const hlsProbe = skipHls
    ? {
        envConfigured: false,
        hlsUrl: null,
        manifestReachable: false,
        detail: "Direct camera mode.",
      }
    : await probeHlsManifest(hlsUrl);

  const preflight = buildPreflightChecks({
    eventPhase,
    countdownConfig,
    streamState: row,
    hlsProbe: skipHls
      ? { ...hlsProbe, hlsUrl: null, manifestReachable: false, detail: "Direct camera mode." }
      : hlsProbe,
    requestedMode: requestedMode && requestedMode !== "none" ? requestedMode : undefined,
    vmix,
    feed,
  });

  const snapshot: OwnerBroadcastSnapshot = {
    capturedAt: new Date().toISOString(),
    eventPhase,
    publish: resolvePublishState(row),
    playback: resolvePlaybackState(row, hlsUrl, manifestReachable),
    feed,
    preflight,
    publisherSessionId: row?.publisher_session_id ?? null,
    publisherChannel: row?.publisher_channel ?? null,
    vmix,
  };

  return {
    snapshot,
    error: streamResult.error,
  };
}
