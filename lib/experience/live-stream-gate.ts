import type { EventLifecycleStage } from "@/lib/experience/event-lifecycle";

export const LIVE_PREVIEW_QUERY_PARAM = "preview";
export const LIVE_HOLDING_OVERRIDE_PARAM = "holding";

export function isLivePreviewOverride(
  searchParams: Pick<URLSearchParams, "get"> | null | undefined,
): boolean {
  return searchParams?.get(LIVE_PREVIEW_QUERY_PARAM) === "true";
}

/** Dev-only — force `/live` holding room artboard + fellowship chat. */
export function isLiveHoldingOverride(
  searchParams: Pick<URLSearchParams, "get"> | null | undefined,
): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  return searchParams?.get(LIVE_HOLDING_OVERRIDE_PARAM) === "1";
}

export type LiveStreamGateInput = {
  lifecycleStage: EventLifecycleStage;
  countdownLoading: boolean;
  openingLiveRoom: boolean;
  previewOverride: boolean;
};

/** True when manifest / LiveKit / HLS init is allowed. */
export function shouldInitializeLiveStream(input: LiveStreamGateInput): boolean {
  const { lifecycleStage, countdownLoading, openingLiveRoom, previewOverride } = input;

  if (previewOverride) return true;
  if (countdownLoading || openingLiveRoom) return false;
  return lifecycleStage === "live";
}

/** True when attendee `/live` should render the live room shell (not holding/countdown). */
export function shouldShowLiveRoomShell(input: LiveStreamGateInput): boolean {
  const { lifecycleStage, openingLiveRoom, previewOverride } = input;

  if (previewOverride) return true;
  if (openingLiveRoom) return false;
  return lifecycleStage === "live";
}

/** Skip background live-state polling only before the holding room opens. */
export function shouldDeferBackgroundLiveSync(
  lifecycleStage: EventLifecycleStage,
  countdownLoading: boolean,
  previewOverride: boolean,
): boolean {
  if (previewOverride) return false;
  // Local dev: always poll /api/access/live and realtime — SSR schedule flags are often stale.
  if (process.env.NODE_ENV === "development") return false;
  if (countdownLoading) return true;
  // Holding room must still receive ops go-live — only defer during announcement.
  return lifecycleStage === "announcement";
}
