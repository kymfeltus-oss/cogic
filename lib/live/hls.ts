/** Manifest index playlists (.m3u8) — strict gate for ops/config surfaces. */
const HLS_MANIFEST_PATTERN = /\.m3u8(\?|$)/i;

/** Media segments and fMP4 parts accepted by the dev HLS relay proxy. */
const HLS_RELAY_MEDIA_PATTERN = /\.(m3u8|ts|m4s|mp4|aac|vtt)(\?|$)/i;

function parseHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isValidHlsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  const parsed = parseHttpUrl(trimmed);
  if (!parsed) return false;

  const path = parsed.pathname.toLowerCase();
  const query = parsed.search.toLowerCase();
  return HLS_MANIFEST_PATTERN.test(path) || query.includes(".m3u8");
}

/**
 * Relaxed validation for `/api/stream/relay` — accepts master/media playlists and segment URLs.
 */
export function isValidRelayTargetUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  const parsed = parseHttpUrl(trimmed);
  if (!parsed) return false;

  if (isValidHlsUrl(trimmed)) return true;

  const path = parsed.pathname;
  const query = parsed.search.toLowerCase();
  return HLS_RELAY_MEDIA_PATTERN.test(path) || query.includes(".m3u8");
}

/** Any non-empty http(s) URL — used for explicit production env overrides before demo fallback. */
export function isValidHttpPlaybackUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return parseHttpUrl(value.trim()) !== null;
}

export function resolveRelayTargetCandidate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const candidates = [trimmed];
  if (trimmed.includes("%")) {
    try {
      candidates.push(decodeURIComponent(trimmed));
    } catch {
      // keep original only
    }
  }

  for (const candidate of candidates) {
    if (isValidRelayTargetUrl(candidate)) return candidate;
  }

  return null;
}

export type PlaybackUrlStatus = "valid" | "invalid" | "missing";

export function resolvePlaybackUrlStatus(raw: string | null | undefined): PlaybackUrlStatus {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return "missing";
  return isValidHlsUrl(trimmed) ? "valid" : "invalid";
}

export const HLS_PLAYBACK_REQUIREMENT =
  "Playback URL must be a valid HLS .m3u8 manifest (http/https).";

export function formatPlaybackLaneLabel(
  status: PlaybackUrlStatus,
  configured: boolean,
): string {
  if (configured) return "Configured";
  if (status === "invalid") return "Invalid (not .m3u8)";
  return "Missing";
}
