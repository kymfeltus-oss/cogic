/**
 * No artificial inflation. Viewer labels must reflect real presence only.
 * Kept as 0 so callers can still share the helper without inventing totals.
 */
export const LIVE_VIEWER_DISPLAY_BUFFER = 0;

export const LIVE_VIEWER_PRESENCE_CHANNEL = "live-viewer-presence";

export function applyLiveViewerDisplayBuffer(actualCount: number): number {
  return Math.max(0, actualCount);
}

export function formatLiveViewerCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (count >= 10_000) {
    return `${Math.round(count / 1_000)}K`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return count.toLocaleString();
}

const PRESENCE_SESSION_KEY = "live_viewer_presence_key";

/** Stable anonymous key when the viewer has no Supabase user id. */
export function resolveLiveViewerPresenceKey(userId: string | null): string {
  if (userId) return userId;

  if (typeof window === "undefined") {
    return "anonymous";
  }

  const existing = sessionStorage.getItem(PRESENCE_SESSION_KEY);
  if (existing) return existing;

  const created =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? `anon_${crypto.randomUUID()}`
      : `anon_${Date.now().toString(36)}`;

  sessionStorage.setItem(PRESENCE_SESSION_KEY, created);
  return created;
}

export function countLiveViewerPresence(
  presenceState: Record<string, unknown[]>,
): number {
  return Object.keys(presenceState).length;
}
