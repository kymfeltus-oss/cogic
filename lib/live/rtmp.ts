/**
 * RTMP ingest URL validation for operator camera / OBS push endpoints.
 * Browsers cannot play RTMP — these URLs are for copy-into-encoder workflows only.
 */
export function isValidRtmpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const normalized = normalizeRtmpUrl(value);
  return normalized !== null;
}

/**
 * Repair common paste mistakes (rtmp://://host, duplicate slashes) before validation/save.
 */
export function normalizeRtmpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let trimmed = value.trim();
  if (!trimmed) return null;

  trimmed = trimmed.replace(/^rtmps?:\/\/\/+/i, (match) =>
    match.toLowerCase().startsWith("rtmps") ? "rtmps://" : "rtmp://",
  );
  trimmed = trimmed.replace(/^(rtmp):\/+/i, "$1://");
  trimmed = trimmed.replace(/^(rtmps):\/+/i, "$1://");

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "rtmp:" && parsed.protocol !== "rtmps:") return null;

    const path = parsed.pathname.replace(/\/{2,}/g, "/");
    const normalized = `${parsed.protocol}//${parsed.host}${path}${parsed.search}${parsed.hash}`;
    return normalized;
  } catch {
    return null;
  }
}

export type RtmpIngestUrlStatus = "valid" | "invalid" | "missing";

export function resolveRtmpIngestUrlStatus(
  raw: string | null | undefined,
): RtmpIngestUrlStatus {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return "missing";
  return isValidRtmpUrl(trimmed) ? "valid" : "invalid";
}

export const RTMP_INGEST_REQUIREMENT =
  "RTMP ingest URL must use rtmp:// or rtmps:// (for OBS, vMix, or mobile encoder push).";

export function formatRtmpIngestLaneLabel(
  status: RtmpIngestUrlStatus,
  configured: boolean,
): string {
  if (configured) return "Configured";
  if (status === "invalid") return "Invalid (not RTMP)";
  return "Missing";
}

/** Mask trailing stream key segment for safe logs — keeps host + app path visible. */
export function maskRtmpIngestUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return `${parsed.protocol}//${parsed.host}/***`;

    const maskedPath =
      segments.length === 1
        ? "/***"
        : `/${segments.slice(0, -1).join("/")}/***`;

    return `${parsed.protocol}//${parsed.host}${maskedPath}`;
  } catch {
    return "***";
  }
}
