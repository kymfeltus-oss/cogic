import type { BroadcastProvider, IngestProfileStatus } from "@/lib/owner/contracts";
import { isDemoManifestPlaybackUrl } from "@/lib/live/manifest-dev-fallback";
import { isValidHlsUrl } from "@/lib/live/hls";

export function detectBroadcastProvider(playbackUrl: string | null | undefined): BroadcastProvider {
  const configured = process.env.BROADCAST_PRIMARY_PROVIDER?.trim().toLowerCase();
  if (configured === "ivs" || configured === "restream" || configured === "external") return configured;

  const value = playbackUrl?.trim() ?? "";
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (host === "live-video.net" || host.endsWith(".live-video.net")) return "ivs";
    if (host.includes("restream")) return "restream";
  } catch {
    // Invalid URLs are handled by playback validation.
  }
  if (process.env.AWS_IVS_CHANNEL_ARN || process.env.AWS_IVS_INGEST_SERVER) return "ivs";
  return "external";
}

export function isProductionPlaybackUrl(url: string | null | undefined): boolean {
  if (!url || isDemoManifestPlaybackUrl(url) || !isValidHlsUrl(url)) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export function isProviderPlaybackConsistent(
  provider: BroadcastProvider,
  url: string | null | undefined,
): boolean {
  if (!isProductionPlaybackUrl(url)) return false;
  try {
    const host = new URL(url as string).hostname.toLowerCase();
    if (provider === "ivs") return host === "live-video.net" || host.endsWith(".live-video.net");
    if (provider === "restream") return host.includes("restream");
    return true;
  } catch {
    return false;
  }
}

export function resolveSafeIngestProfile(
  playbackUrl: string | null,
  backupUrl: string | null,
  streamLive = false,
): IngestProfileStatus {
  const provider = detectBroadcastProvider(playbackUrl);
  const requestedProtocol = process.env.AWS_IVS_INGEST_PROTOCOL?.trim().toLowerCase();
  const hasSrt = Boolean(
    process.env.AWS_IVS_SRT_ENDPOINT?.trim() &&
      process.env.AWS_IVS_SRT_PORT?.trim() &&
      process.env.AWS_IVS_SRT_STREAM_ID?.trim() &&
      process.env.AWS_IVS_SRT_PASSPHRASE?.trim(),
  );
  const hasRtmps = Boolean(
    process.env.AWS_IVS_INGEST_SERVER?.trim() && process.env.AWS_IVS_STREAM_KEY?.trim(),
  );
  const protocol = requestedProtocol === "srt"
    ? (hasSrt ? "srt" : "unconfigured")
    : requestedProtocol === "rtmps"
      ? (hasRtmps ? "rtmps" : "unconfigured")
      : requestedProtocol === "rtmp" && hasRtmps && process.env.AWS_IVS_ALLOW_RTMP === "true"
        ? "rtmp"
        : "unconfigured";

  const playbackConfigured = isProductionPlaybackUrl(playbackUrl);
  const ingestConfigured = provider === "ivs" && protocol !== "unconfigured";
  return {
    provider,
    protocol,
    ingestConfigured,
    playbackConfigured,
    channelConfigured: Boolean(process.env.AWS_IVS_CHANNEL_NAME?.trim() && process.env.AWS_IVS_CHANNEL_ARN?.trim()),
    recordingConfigured: process.env.AWS_IVS_RECORDING_ENABLED?.trim().toLowerCase() === "true",
    recordingActive: process.env.AWS_IVS_RECORDING_ENABLED?.trim().toLowerCase() === "true" && streamLive,
    backupConfigured: isProductionPlaybackUrl(backupUrl),
    crewConnectionReady: ingestConfigured && playbackConfigured,
  };
}
