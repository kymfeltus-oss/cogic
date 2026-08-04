/** Amazon IVS channel reference parsed from an ARN or playback URL path. */
export type IvsChannelRef = {
  region: string;
  accountId: string;
  channelId: string;
  hostId?: string;
};

const IVS_ARN_PATTERN =
  /^arn:aws:ivs:([a-z0-9-]+):(\d+):channel\/([A-Za-z0-9]+)$/i;

/** Path tail: /api/video/v1/{region}.{accountId}.channel.{channelId}.m3u8 */
const IVS_PLAYBACK_PATH_PATTERN =
  /\/api\/video\/v1\/([a-z0-9-]+)\.(\d+)\.channel\.([A-Za-z0-9]+)\.m3u8$/i;

/** Hostname: {hostId}.{region}.playback.live-video.net */
const IVS_PLAYBACK_HOST_PATTERN =
  /^([a-f0-9]+)\.([a-z0-9-]+)\.playback\.live-video\.net$/i;

/** Hostname: {hostId}.global-contribute.live-video.net */
const IVS_INGEST_HOST_PATTERN =
  /^([a-f0-9]+)\.global-contribute\.live-video\.net$/i;

/**
 * Parse `arn:aws:ivs:us-east-1:484908301695:channel/jj20qLRLUTLp`.
 * Channel ID is the segment after `channel/` — not the playback hostname prefix.
 */
export function parseIvsChannelArn(raw: string | null | undefined): IvsChannelRef | null {
  const arn = raw?.trim() ?? "";
  if (!arn) return null;

  const match = IVS_ARN_PATTERN.exec(arn);
  if (!match) return null;

  return {
    region: match[1].toLowerCase(),
    accountId: match[2],
    channelId: match[3],
  };
}

/** Extract the unique IVS host ID from a playback URL hostname (e.g. 6c41d71a4403). */
export function parseIvsHostIdFromPlaybackUrl(raw: string | null | undefined): string | null {
  const url = raw?.trim() ?? "";
  if (!url) return null;

  try {
    const match = IVS_PLAYBACK_HOST_PATTERN.exec(new URL(url).hostname.toLowerCase());
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Extract the unique IVS host ID from an ingest server URL. */
export function parseIvsHostIdFromIngestUrl(raw: string | null | undefined): string | null {
  const url = raw?.trim() ?? "";
  if (!url) return null;

  try {
    const match = IVS_INGEST_HOST_PATTERN.exec(new URL(url).hostname.toLowerCase());
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Extract region, account, channel ID, and host ID from an IVS HLS playback URL. */
export function parseIvsPlaybackUrl(raw: string | null | undefined): IvsChannelRef | null {
  const url = raw?.trim() ?? "";
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const match = IVS_PLAYBACK_PATH_PATTERN.exec(parsed.pathname);
    if (!match) return null;

    const hostId = parseIvsHostIdFromPlaybackUrl(url);
    return {
      region: match[1].toLowerCase(),
      accountId: match[2],
      channelId: match[3],
      hostId: hostId ?? undefined,
    };
  } catch {
    return null;
  }
}

export function isAmazonIvsPlaybackUrl(url: string): boolean {
  return parseIvsPlaybackUrl(url) !== null;
}

/** IVS channel IDs retired from this project — reject if still present in DB/env URLs. */
export const KNOWN_STALE_IVS_CHANNEL_IDS = ["KLoL2ogCRZRV"] as const;

export function isStaleIvsChannelPlaybackUrl(raw: string | null | undefined): boolean {
  const ref = parseIvsPlaybackUrl(raw);
  if (!ref) return false;
  return (KNOWN_STALE_IVS_CHANNEL_IDS as readonly string[]).includes(ref.channelId);
}

/** True when playback URL region, account, and channel ID match the configured ARN. */
export function ivsPlaybackUrlMatchesArn(
  playbackUrl: string,
  channelArn: string,
): boolean {
  const fromArn = parseIvsChannelArn(channelArn);
  const fromUrl = parseIvsPlaybackUrl(playbackUrl);
  if (!fromArn || !fromUrl) return false;

  return (
    fromArn.region === fromUrl.region &&
    fromArn.accountId === fromUrl.accountId &&
    fromArn.channelId === fromUrl.channelId
  );
}

/** True when playback and ingest URLs share the same IVS host ID. */
export function ivsHostIdsMatch(
  playbackUrl: string | null | undefined,
  ingestUrl: string | null | undefined,
  expectedHostId?: string | null,
): boolean {
  const playbackHostId = parseIvsHostIdFromPlaybackUrl(playbackUrl);
  const ingestHostId = parseIvsHostIdFromIngestUrl(ingestUrl);
  const configuredHostId = expectedHostId?.trim() || null;

  if (!playbackHostId || !ingestHostId) return false;
  if (playbackHostId !== ingestHostId) return false;
  if (configuredHostId && playbackHostId !== configuredHostId) return false;
  return true;
}
