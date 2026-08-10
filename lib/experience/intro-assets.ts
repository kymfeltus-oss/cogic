/** Intro splash — mobile plate + overlay slots. */

import { MOBILE_ARTBOARD_REF } from "@/lib/responsive";

/** Cache-bust when replacing `public/intro mobile.png`. */
export const INTRO_IMAGE_ASSET_VERSION = "20260808";

/** Served from `public/intro mobile.png` (941×1672). */
export const INTRO_VIDEO_SRC = `/intro%20mobile.png?v=${INTRO_IMAGE_ASSET_VERSION}`;

/** Native intro plate — must match PNG pixels so Enter % slots align. */
export const INTRO_VIDEO_ART = {
  width: 941,
  height: 1672,
} as const;

/** Stage column width — matches attendee dashboard track. */
export const INTRO_MOBILE_ART = MOBILE_ARTBOARD_REF;

export type IntroLayoutRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Enter CTA aligned to the baked pill on `intro mobile.png` (941×1672).
 * Measured from the solid magenta→blue button body (px 228,1385 → 633,1516).
 */
export const INTRO_ENTER_PANEL = {
  left: 24.23,
  top: 82.835,
  width: 43.146,
  height: 7.895,
} as const satisfies IntroLayoutRect;
