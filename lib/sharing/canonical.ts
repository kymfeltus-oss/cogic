/** Canonical public share origins — never expose private stream/provider URLs. */

export const CANONICAL_LIVE_PATH = "/live";

export function resolvePublicOrigin(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.COGIC_STREAM_PUBLIC_WEB_ORIGIN?.trim() ||
    "";
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // fall through
    }
  }
  if (typeof window !== "undefined") return window.location.origin;
  return "https://cogiclive.com";
}

export function buildCanonicalLiveShareUrl(): string {
  return `${resolvePublicOrigin()}${CANONICAL_LIVE_PATH}`;
}

export function buildCanonicalReplayShareUrl(replayId: string): string {
  return `${resolvePublicOrigin()}/replays/${encodeURIComponent(replayId)}`;
}
