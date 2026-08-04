import { isValidHlsUrl } from "@/lib/live/hls";
import type { ManifestStreamSource } from "@/lib/live/fetch-manifest-stream-config";
import {
  normalizeEnvPlaybackString,
  resolvePrimaryAttendeePlaybackFromEnv,
} from "@/lib/live/manifest-dev-fallback";

export type FeedUrlInputs = {
  primary_playback_url?: string | null;
  backup_playback_url?: string | null;
  playback_url?: string | null;
  active_source?: string | null;
  is_live?: boolean;
};

/** Server-only backup HLS manifest (Amazon IVS, etc.). */
export function resolveBackupPlaybackFromEnv(): string | null {
  const backup = normalizeEnvPlaybackString(process.env.ATTENDEE_BACKUP_HLS_URL);
  if (backup && isValidHlsUrl(backup)) return backup;
  return null;
}

export function resolvePrimaryFeedUrl(inputs: FeedUrlInputs = {}): string | null {
  const env = resolvePrimaryAttendeePlaybackFromEnv();
  if (env) return env;

  const dbPrimary = inputs.primary_playback_url?.trim() ?? "";
  if (dbPrimary && isValidHlsUrl(dbPrimary)) return dbPrimary;

  const legacy = inputs.playback_url?.trim() ?? "";
  if (legacy && isValidHlsUrl(legacy)) return legacy;

  return null;
}

export function resolveBackupFeedUrl(inputs: FeedUrlInputs = {}): string | null {
  const env = resolveBackupPlaybackFromEnv();
  if (env) return env;

  const dbBackup = inputs.backup_playback_url?.trim() ?? "";
  if (dbBackup && isValidHlsUrl(dbBackup)) return dbBackup;

  return null;
}

export function normalizeActiveFeedSource(
  raw: string | null | undefined,
  isLive: boolean,
): ManifestStreamSource {
  if (raw === "primary" || raw === "backup" || raw === "offline") {
    return raw;
  }
  return isLive ? "primary" : "offline";
}

export function resolveActiveFeedPlaybackUrl(inputs: FeedUrlInputs): {
  url: string | null;
  activeSource: ManifestStreamSource;
} {
  const activeSource = normalizeActiveFeedSource(inputs.active_source, inputs.is_live === true);
  const primary = resolvePrimaryFeedUrl(inputs);
  const backup = resolveBackupFeedUrl(inputs);

  if (activeSource === "backup") {
    if (backup) return { url: backup, activeSource: "backup" };
    if (primary) return { url: primary, activeSource: "primary" };
    return { url: null, activeSource: "offline" };
  }

  if (activeSource === "primary") {
    return { url: primary, activeSource: primary ? "primary" : "offline" };
  }

  return { url: null, activeSource: "offline" };
}

export function seedFeedUrlsFromEnv(): {
  primary_playback_url: string | null;
  backup_playback_url: string | null;
} {
  return {
    primary_playback_url: resolvePrimaryFeedUrl({}),
    backup_playback_url: resolveBackupFeedUrl({}),
  };
}
