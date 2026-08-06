import type { SupabaseClient } from "@supabase/supabase-js";
import type { GoLiveRequestBody, OwnerBroadcastSnapshot, PublishMode, SwitchFeedRequestBody } from "@/lib/owner/contracts";
import { buildOwnerBroadcastSnapshot } from "@/lib/owner/build-broadcast-snapshot";
import { emitStreamStateSync } from "@/lib/owner/broadcast-stream-sync";
import {
  resolveBackupFeedUrl,
  resolvePrimaryFeedUrl,
  seedFeedUrlsFromEnv,
} from "@/lib/owner/feed-urls";
import { loadOwnerStreamState, updateOwnerStreamState } from "@/lib/owner/load-owner-state";
import {
  preflightHasBlockers,
  parseGoLiveBody,
  parseSwitchFeedBody,
} from "@/lib/owner/preflight";
import { probeHlsManifest } from "@/lib/owner/hls-readiness";
import { startVmixStreaming, stopVmixStreaming } from "@/lib/owner/vmix/client";

export { parseGoLiveBody, parseSwitchFeedBody };

export async function runOwnerPreflight(
  mode?: PublishMode,
): Promise<{ snapshot: OwnerBroadcastSnapshot; blocked: boolean }> {
  const admin = (await import("@/lib/supabase/server")).getSupabaseAdmin();
  const { row } = await loadOwnerStreamState(admin);

  if (row && row.publish_status !== "publishing") {
    await updateOwnerStreamState(admin, {
      publish_status: "preflight",
      publish_error_message: null,
      updated_by: "owner_preflight",
    });
  }

  const { snapshot } = await buildOwnerBroadcastSnapshot(mode);
  return { snapshot, blocked: preflightHasBlockers(snapshot.preflight) };
}

export async function runOwnerGoLive(
  admin: SupabaseClient,
  body: GoLiveRequestBody,
  updatedBy: string,
): Promise<{ ok: boolean; snapshot: OwnerBroadcastSnapshot; message: string }> {
  const { row } = await loadOwnerStreamState(admin);
  if (row?.is_live) {
    const { snapshot } = await buildOwnerBroadcastSnapshot(body.mode);
    return { ok: false, snapshot, message: "Broadcast is already live." };
  }

  const feedInputs = {
    primary_playback_url: row?.primary_playback_url,
    backup_playback_url: row?.backup_playback_url,
    playback_url: row?.playback_url,
    active_source: row?.active_source,
    is_live: row?.is_live,
  };
  const seeded = seedFeedUrlsFromEnv();
  const primaryUrl = resolvePrimaryFeedUrl(feedInputs) ?? seeded.primary_playback_url;
  const backupUrl = resolveBackupFeedUrl(feedInputs) ?? seeded.backup_playback_url;
  const { snapshot: preflightSnapshot } = await buildOwnerBroadcastSnapshot(body.mode);
  const preflight = preflightSnapshot.preflight;

  if (preflightHasBlockers(preflight) && !body.confirm) {
    const { snapshot } = await buildOwnerBroadcastSnapshot(body.mode);
    return {
      ok: false,
      snapshot: { ...snapshot, preflight },
      message: "Preflight checks failed. Fix blockers or send confirm: true to override warnings only.",
    };
  }

  const fails = preflight.filter((c) => c.status === "fail");
  if (fails.length > 0) {
    const { snapshot } = await buildOwnerBroadcastSnapshot(body.mode);
    return {
      ok: false,
      snapshot: { ...snapshot, preflight },
      message: fails.map((f) => f.detail ?? f.label).join(" "),
    };
  }

  await updateOwnerStreamState(admin, {
    publish_mode: body.mode,
    publish_status: "starting",
    publish_error_message: null,
    playback_status: "ready",
    playback_error_message: null,
    updated_by: updatedBy,
  });

  if (body.mode === "rtmp_encoder" && process.env.VMIX_REQUIRED === "true") {
    const vmixStart = await startVmixStreaming();
    if (!vmixStart.ok) {
      await updateOwnerStreamState(admin, {
        publish_status: "error",
        publish_error_message: vmixStart.message,
        updated_by: updatedBy,
      });
      const { snapshot } = await buildOwnerBroadcastSnapshot(body.mode);
      return { ok: false, snapshot, message: vmixStart.message };
    }
  }

  const playbackUrl = body.mode === "browser_camera" ? row?.playback_url : primaryUrl;

  await updateOwnerStreamState(admin, {
    publish_status: "publishing",
    playback_status: "playback_pending",
    is_live: true,
    active_source: "primary",
    primary_playback_url: primaryUrl,
    backup_playback_url: backupUrl,
    playback_url: playbackUrl ?? primaryUrl ?? row?.playback_url,
    updated_by: updatedBy,
  });

  await emitStreamStateSync();

  // Authoritative OFFLINE→LIVE only — never from playback URL / preflight alone.
  try {
    const { sendLiveStartPushAlert } = await import("@/lib/push/live-alert");
    await sendLiveStartPushAlert({
      triggeredBy: updatedBy,
      serviceTitle: row?.concert_title ?? null,
    });
  } catch (pushError) {
    console.error(
      "[owner/go-live] live push alert failed:",
      pushError instanceof Error ? pushError.message : "unknown",
    );
  }

  const { snapshot } = await buildOwnerBroadcastSnapshot(body.mode);
  return {
    ok: true,
    snapshot,
    message: "Go-live requested. Playback may remain pending until the manifest is ready.",
  };
}

export async function runOwnerEndBroadcast(
  admin: SupabaseClient,
  updatedBy: string,
): Promise<{ ok: boolean; snapshot: OwnerBroadcastSnapshot; message: string }> {
  const { row } = await loadOwnerStreamState(admin);
  if (!row?.is_live) {
    const { snapshot } = await buildOwnerBroadcastSnapshot();
    return { ok: false, snapshot, message: "Broadcast is not live." };
  }

  await updateOwnerStreamState(admin, {
    publish_status: "ending",
    updated_by: updatedBy,
  });

  if (row.publish_mode === "rtmp_encoder") {
    await stopVmixStreaming();
  }

  await updateOwnerStreamState(admin, {
    is_live: false,
    active_source: "offline",
    publish_status: "offline",
    publish_mode: "none",
    playback_status: "ready",
    playback_error_message: null,
    publish_error_message: null,
    publisher_session_id: null,
    publisher_channel: null,
    updated_by: updatedBy,
  });

  await emitStreamStateSync();

  try {
    const { closeLivePushSession } = await import("@/lib/push/live-alert");
    await closeLivePushSession();
  } catch {
    // Non-blocking — ending broadcast must succeed even if push ledger update fails.
  }

  const { snapshot } = await buildOwnerBroadcastSnapshot();
  return { ok: true, snapshot, message: "Broadcast ended." };
}

export async function runOwnerSwitchFeed(
  admin: SupabaseClient,
  body: SwitchFeedRequestBody,
  updatedBy: string,
): Promise<{ ok: boolean; snapshot: OwnerBroadcastSnapshot; message: string }> {
  const { row } = await loadOwnerStreamState(admin);

  if (!row?.is_live) {
    const { snapshot } = await buildOwnerBroadcastSnapshot();
    return { ok: false, snapshot, message: "Broadcast is not live — go live before switching feeds." };
  }

  if (row.publish_mode === "browser_camera") {
    const { snapshot } = await buildOwnerBroadcastSnapshot();
    return {
      ok: false,
      snapshot,
      message: "Direct camera mode uses WebRTC — end and use HLS go-live for dual-ingest failover.",
    };
  }

  const feedInputs = {
    primary_playback_url: row.primary_playback_url,
    backup_playback_url: row.backup_playback_url,
    playback_url: row.playback_url,
    active_source: row.active_source,
    is_live: true,
  };

  const targetUrl =
    body.source === "backup"
      ? resolveBackupFeedUrl(feedInputs)
      : resolvePrimaryFeedUrl(feedInputs);

  if (!targetUrl) {
    const { snapshot } = await buildOwnerBroadcastSnapshot();
    return {
      ok: false,
      snapshot,
      message:
        body.source === "backup"
          ? "Backup feed URL is not configured. Set ATTENDEE_BACKUP_HLS_URL."
          : "Primary feed URL is not configured. Set ATTENDEE_PLAYBACK_HLS_URL.",
    };
  }

  const probe = await probeHlsManifest(targetUrl);
  if (!probe.manifestReachable && !body.confirm) {
    const { snapshot } = await buildOwnerBroadcastSnapshot();
    return {
      ok: false,
      snapshot,
      message: `${body.source === "backup" ? "Backup" : "Primary"} manifest is not reachable. Send confirm: true to switch anyway.`,
    };
  }

  if (row.active_source === body.source) {
    const { snapshot } = await buildOwnerBroadcastSnapshot();
    return {
      ok: true,
      snapshot,
      message: `Already routing attendees to ${body.source} feed.`,
    };
  }

  await updateOwnerStreamState(admin, {
    active_source: body.source,
    playback_url: targetUrl,
    playback_status: "playback_pending",
    playback_error_message: null,
    updated_by: updatedBy,
  });

  await emitStreamStateSync();

  const { snapshot } = await buildOwnerBroadcastSnapshot();
  return {
    ok: true,
    snapshot,
    message:
      body.source === "backup"
        ? "Failover active — attendees switched to backup (IVS) feed."
        : "Attendees switched back to primary (Restream) feed.",
  };
}
