import { isValidRtmpUrl } from "@/lib/live/rtmp";

const DEFAULT_STREAM_KEY_PREFIX = "300awakening_live";
export const DEFAULT_RTMP_INGEST_SERVER_BASE = "rtmp://vitalorgansent.com/live";

/** RTMP server base for encoder "Server URL" field (no trailing stream key). */
export function resolveRtmpIngestServerBase(): string {
  const fromEnv = process.env.RTMP_INGEST_SERVER_BASE?.trim();
  if (fromEnv) {
    const normalized = fromEnv.replace(/\/+$/, "");
    if (isValidRtmpUrl(normalized)) return normalized;
  }
  return DEFAULT_RTMP_INGEST_SERVER_BASE;
}

/** Full push URL stored in live_stream_state.primary_rtmp_ingest_url. */
export function buildPrimaryRtmpIngestUrl(
  streamKey: string,
  serverBase: string = resolveRtmpIngestServerBase(),
): string {
  const base = serverBase.replace(/\/+$/, "");
  const key = streamKey.trim().replace(/^\/+/, "");
  return `${base}/${key}`;
}

export type RtmpIngestParts = {
  serverUrl: string;
  streamKey: string;
  fullUrl: string;
};

const RTMP_APP_MOUNT_SEGMENTS = new Set(["live", "app", "stream"]);

function isLikelyDedicatedStreamKey(segment: string): boolean {
  const trimmed = segment.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith(`${DEFAULT_STREAM_KEY_PREFIX}_`)) return true;
  if (trimmed.startsWith("re_")) return true;
  return trimmed.length >= 12 && !RTMP_APP_MOUNT_SEGMENTS.has(trimmed.toLowerCase());
}

/** Split a stored RTMP ingest URL into encoder server + stream key fields. */
export function splitRtmpIngestUrl(fullUrl: string | null | undefined): RtmpIngestParts | null {
  const trimmed = fullUrl?.trim() ?? "";
  if (!isValidRtmpUrl(trimmed)) return null;

  try {
    const parsed = new URL(trimmed);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;

    if (segments.length === 1) {
      const only = segments[0] ?? "";
      if (!isLikelyDedicatedStreamKey(only)) return null;
      return {
        serverUrl: `${parsed.protocol}//${parsed.host}`,
        streamKey: only,
        fullUrl: trimmed,
      };
    }

    const streamKey = segments[segments.length - 1] ?? "";
    if (!streamKey || RTMP_APP_MOUNT_SEGMENTS.has(streamKey.toLowerCase())) {
      return null;
    }

    const serverPath = segments.slice(0, -1);
    const serverUrl = `${parsed.protocol}//${parsed.host}${
      serverPath.length > 0 ? `/${serverPath.join("/")}` : ""
    }`;

    return { serverUrl, streamKey, fullUrl: trimmed };
  } catch {
    return null;
  }
}

export function resolveRtmpIngestCredentials(
  fullUrl: string | null | undefined,
): RtmpIngestParts | null {
  return splitRtmpIngestUrl(fullUrl);
}
