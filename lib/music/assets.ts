/** Music page — mobile artboard (COGIC LIVE; no third-party artist promo). */

import {
  ATTENDEE_DASHBOARD_PATH,
  MOBILE_ARTBOARD_BACK_HOTSPOT,
} from "@/lib/navigation/back-to-dashboard";
import { MOBILE_ARTBOARD_REF } from "@/lib/responsive";

export const MUSIC_ASSETS = {
  mobileBackground: "/my-sanctuary/banner.png",
} as const;

export const MUSIC_MOBILE_ART = MOBILE_ARTBOARD_REF;

export const MUSIC_MOBILE_ART_NATIVE = MOBILE_ARTBOARD_REF;

export type MusicPageAction = {
  id: string;
  label: string;
  href: string;
  external?: boolean;
  left: string;
  top: string;
  width: string;
  height: string;
};

/** Percentage hit targets on the mobile artboard (1080×1920). */
export const MUSIC_PAGE_ACTIONS: readonly MusicPageAction[] = [
  {
    id: "back",
    label: MOBILE_ARTBOARD_BACK_HOTSPOT.label,
    href: ATTENDEE_DASHBOARD_PATH,
    left: MOBILE_ARTBOARD_BACK_HOTSPOT.left,
    top: MOBILE_ARTBOARD_BACK_HOTSPOT.top,
    width: MOBILE_ARTBOARD_BACK_HOTSPOT.width,
    height: MOBILE_ARTBOARD_BACK_HOTSPOT.height,
  },
] as const;

/** Hotspots — back handled by MobileArtboardTabHeader. */
export const MUSIC_MOBILE_VISIBLE_ACTION_IDS = [] as const;
