/** Intro splash — mobile video plate + overlay slots. */

import { MOBILE_ARTBOARD_REF } from "@/lib/responsive";

export const INTRO_VIDEO_SRC = "/intro%20mobile.mp4";

/** Cache-bust when replacing `public/intro-music.m4a`. */
export const INTRO_MUSIC_ASSET_VERSION = "20260618";

/** Served from `public/intro-music.m4a`. */
export const INTRO_MUSIC_SRC = `/intro-music.m4a?v=${INTRO_MUSIC_ASSET_VERSION}`;

/** Native intro mobile.mp4 export (9:16 — same ratio as dashboard track). */
export const INTRO_VIDEO_ART = {
  width: 720,
  height: 1280,
} as const;

/** Stage column width — matches attendee dashboard track. */
export const INTRO_MOBILE_ART = MOBILE_ARTBOARD_REF;

export type IntroLayoutRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Enter CTA aligned to intro mobile.mp4 art (720×1280). */
export const INTRO_ENTER_PANEL = {
  left: 10,
  top: 76.5,
  width: 84,
  height: 12.5,
} as const satisfies IntroLayoutRect;
