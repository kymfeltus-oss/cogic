import {
  ivsHostIdsMatch,
  ivsPlaybackUrlMatchesArn,
  parseIvsChannelArn,
  parseIvsHostIdFromIngestUrl,
  parseIvsHostIdFromPlaybackUrl,
} from "@/lib/live/ivs-playback-url";
import { normalizeEnvPlaybackString } from "@/lib/live/manifest-dev-fallback";

export type IvsChannelConfig = {
  channelName: string | null;
  hostId: string | null;
  channelArn: string | null;
  region: string | null;
  accountId: string | null;
  channelId: string | null;
  ingestServer: string | null;
  streamKey: string | null;
  playbackUrl: string | null;
  configured: boolean;
  hostIdsConsistent: boolean;
  playbackMatchesArn: boolean;
};

/** Server-only — Amazon IVS Lane B (backup) channel from env. */
export function resolveIvsChannelConfig(): IvsChannelConfig {
  const channelName = process.env.AWS_IVS_CHANNEL_NAME?.trim() || null;
  const hostId = process.env.AWS_IVS_HOST_ID?.trim() || null;
  const channelArn = process.env.AWS_IVS_CHANNEL_ARN?.trim() || null;
  const ingestServer = process.env.AWS_IVS_INGEST_SERVER?.trim() || null;
  const streamKey = process.env.AWS_IVS_STREAM_KEY?.trim() || null;
  const playbackUrl =
    normalizeEnvPlaybackString(process.env.ATTENDEE_BACKUP_HLS_URL) ||
    normalizeEnvPlaybackString(process.env.ATTENDEE_PLAYBACK_HLS_URL);

  const arnRef = parseIvsChannelArn(channelArn);
  const playbackHostId = parseIvsHostIdFromPlaybackUrl(playbackUrl);
  const ingestHostId = parseIvsHostIdFromIngestUrl(ingestServer);

  const resolvedHostId = hostId ?? playbackHostId ?? ingestHostId;
  const hostIdsConsistent = ivsHostIdsMatch(playbackUrl, ingestServer, resolvedHostId);
  const playbackMatchesArn = channelArn && playbackUrl ? ivsPlaybackUrlMatchesArn(playbackUrl, channelArn) : false;

  return {
    channelName,
    hostId: resolvedHostId,
    channelArn,
    region: arnRef?.region ?? null,
    accountId: arnRef?.accountId ?? null,
    channelId: arnRef?.channelId ?? null,
    ingestServer,
    streamKey,
    playbackUrl,
    configured: Boolean(playbackUrl && channelArn),
    hostIdsConsistent,
    playbackMatchesArn,
  };
}

export type IvsIngestCredentials = {
  ingestServer: string | null;
  streamKey: string | null;
  channelName: string | null;
  hostId: string | null;
  playbackUrl: string | null;
  source: "env" | "unconfigured";
  detail: string | null;
};

/** Owner-only IVS backup ingest credentials (Lane B). */
export function resolveIvsIngestCredentials(): IvsIngestCredentials {
  const config = resolveIvsChannelConfig();

  if (!config.ingestServer && !config.streamKey) {
    return {
      ingestServer: null,
      streamKey: null,
      channelName: config.channelName,
      hostId: config.hostId,
      playbackUrl: config.playbackUrl,
      source: "unconfigured",
      detail: "Set AWS_IVS_INGEST_SERVER and AWS_IVS_STREAM_KEY for Lane B backup ingest.",
    };
  }

  return {
    ingestServer: config.ingestServer,
    streamKey: config.streamKey,
    channelName: config.channelName,
    hostId: config.hostId,
    playbackUrl: config.playbackUrl,
    source: "env",
    detail:
      config.ingestServer && config.streamKey
        ? `Amazon IVS backup ingest loaded (${config.channelName ?? "channel"}).`
        : "Partial IVS configuration — verify ingest server and stream key.",
  };
}
