import { isValidHlsUrl } from "@/lib/live/hls";
import { resolveAttendeePlaybackFromEnv } from "@/lib/live/manifest-dev-fallback";

export type HlsProbeResult = {
  envConfigured: boolean;
  hlsUrl: string | null;
  manifestReachable: boolean;
  detail: string | null;
};

const MANIFEST_PROBE_TIMEOUT_MS = 6_000;

export function resolveSafePublicHlsUrl(
  dbPlaybackUrl: string | null | undefined,
): string | null {
  const envUrl = resolveAttendeePlaybackFromEnv();
  const dbUrl = dbPlaybackUrl?.trim() ?? "";

  if (envUrl && isValidHlsUrl(envUrl)) return envUrl;
  if (dbUrl && isValidHlsUrl(dbUrl)) return dbUrl;
  if (envUrl) return envUrl;
  if (dbUrl) return dbUrl;
  return null;
}

export async function probeHlsManifest(url: string | null): Promise<HlsProbeResult> {
  const envConfigured = Boolean(resolveAttendeePlaybackFromEnv()?.trim());
  const hlsUrl = url;

  if (!hlsUrl) {
    return {
      envConfigured,
      hlsUrl: null,
      manifestReachable: false,
      detail: "No public HLS manifest configured.",
    };
  }

  if (!isValidHlsUrl(hlsUrl)) {
    return {
      envConfigured,
      hlsUrl,
      manifestReachable: false,
      detail: "Playback URL is not a valid .m3u8 manifest.",
    };
  }

  try {
    const response = await fetch(hlsUrl, {
      method: "GET",
      headers: { Accept: "application/vnd.apple.mpegurl, application/x-mpegURL, */*" },
      signal: AbortSignal.timeout(MANIFEST_PROBE_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        envConfigured,
        hlsUrl,
        manifestReachable: false,
        detail: `Manifest request failed (${response.status}).`,
      };
    }

    const body = await response.text();
    const looksLikeManifest = body.includes("#EXTM3U");
    return {
      envConfigured,
      hlsUrl,
      manifestReachable: looksLikeManifest,
      detail: looksLikeManifest ? null : "Response was not an HLS manifest.",
    };
  } catch (error) {
    return {
      envConfigured,
      hlsUrl,
      manifestReachable: false,
      detail: error instanceof Error ? error.message : "Manifest probe failed.",
    };
  }
}
