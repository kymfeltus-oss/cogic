import { isValidRtmpUrl } from "@/lib/live/rtmp";

/** push = OBS encoder → Restream; pull = Restream → vMix/OBS monitor */
export type RtmpStreamLinkKind = "push" | "pull" | "unknown";

/**
 * Classify a Restream RTMP URL so push links land in ingest columns, not pull columns.
 */
export function classifyRtmpStreamLink(value: unknown): RtmpStreamLinkKind {
  if (!isValidRtmpUrl(value)) return "unknown";

  const trimmed = value.trim();
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    if (host.includes("pull")) return "pull";
    if (host.includes("live.restream.io")) return "push";
    if (host.startsWith("live.")) return "push";
    if (host.includes("vitalorgansent.com")) return "push";

    const path = parsed.pathname.toLowerCase();
    if (path.includes("/live/")) return "push";
    if (path.includes("/pull/")) return "pull";
  } catch {
    return "unknown";
  }

  return "unknown";
}

/**
 * RTMP pull URL validation for operator monitoring ingest (Restream pull links).
 * Browsers cannot play RTMP — pair with camera_preview_hls_url for in-app preview.
 */
export function isValidRtmpPullUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "rtmp:" && parsed.protocol !== "rtmps:") return false;
    return parsed.hostname.toLowerCase().includes("pull");
  } catch {
    return false;
  }
}

/** Accept any valid RTMP URL when hostname lacks pull (manual operator paste). */
export function isValidRtmpPullUrlLoose(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "rtmp:" || parsed.protocol === "rtmps:";
  } catch {
    return false;
  }
}

export type RtmpPullUrlStatus = "valid" | "invalid" | "missing";

export function resolveRtmpPullUrlStatus(
  raw: string | null | undefined,
): RtmpPullUrlStatus {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return "missing";
  return isValidRtmpPullUrl(trimmed) ? "valid" : "invalid";
}

export const RTMP_PULL_REQUIREMENT =
  "RTMP pull URL must use rtmp://pull.restream.io/pull/... (Restream RTMP Pull link for vMix/OBS monitoring).";

export const RTMP_PUSH_IN_PULL_FIELD =
  "This is an OBS push link (rtmp://live.restream.io/live/...). It belongs in Host Ingest, not RTMP Pull. Save again — the app will route it automatically.";

export function formatRtmpPullLaneLabel(
  status: RtmpPullUrlStatus,
  configured: boolean,
): string {
  if (configured) return "Configured";
  if (status === "invalid") return "Invalid (not RTMP)";
  return "Missing";
}

export function buildRestreamPullCombinedUrl(streamKey: string): string {
  const key = streamKey.trim();
  return `rtmp://pull.restream.io/pull/${key}`;
}
