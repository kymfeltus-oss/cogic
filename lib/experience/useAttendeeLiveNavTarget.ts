"use client";

import { EXPERIENCE_LIVE_PATH } from "@/lib/experience/live-routes";
import type { AttendeeLiveNavTarget } from "@/lib/experience/resolve-live-nav-target";
import type { EventCountdownConfig } from "@/lib/live/countdown-config";

type UseAttendeeLiveNavTargetOptions = {
  initialConfig?: EventCountdownConfig;
};

type UseAttendeeLiveNavTargetResult = {
  href: AttendeeLiveNavTarget;
  isLoading: boolean;
};

/** Attendee Live nav always opens the full-page live room at `/live`. */
export function useAttendeeLiveNavTarget(
  _options: UseAttendeeLiveNavTargetOptions = {},
): UseAttendeeLiveNavTargetResult {
  return {
    href: EXPERIENCE_LIVE_PATH,
    isLoading: false,
  };
}

/** @deprecated Use EXPERIENCE_LIVE_PATH — kept for import compatibility. */
export const ATTENDEE_LIVE_NAV_FALLBACK = EXPERIENCE_LIVE_PATH;
