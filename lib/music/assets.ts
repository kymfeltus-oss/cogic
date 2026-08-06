/** Music page — mobile artboard + interactive action targets. */

import {
  ATTENDEE_DASHBOARD_PATH,
  MOBILE_ARTBOARD_BACK_HOTSPOT,
} from "@/lib/navigation/back-to-dashboard";
import { MOBILE_ARTBOARD_REF } from "@/lib/responsive";

export const APPLE_MUSIC_SINGLE_URL =
  "https://music.apple.com/us/artist/ian-craig-300/1643247247";

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
  {
    id: "apple-music-cover",
    label: "Buy on Apple Music",
    href: APPLE_MUSIC_SINGLE_URL,
    external: true,
    left: "5%",
    top: "44.5%",
    width: "48%",
    height: "5.5%",
  },
  {
    id: "apple-music",
    label: "Get it on Apple Music",
    href: APPLE_MUSIC_SINGLE_URL,
    external: true,
    left: "5%",
    top: "69.5%",
    width: "90%",
    height: "13.5%",
  },
] as const;

/** Hotspots aligned to `background image mobile.png` — back handled by MobileArtboardTabHeader. */
export const MUSIC_MOBILE_VISIBLE_ACTION_IDS = [
  "apple-music-cover",
  "apple-music",
] as const;
