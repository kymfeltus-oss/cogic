import { MOBILE_ARTBOARD_BACK_HOTSPOT } from "@/lib/navigation/back-to-dashboard";

export type MobileArtboardChromeRect = {
  left: string;
  top: string;
  width: string;
  height: string;
};

/** Shared top row on Live · Giving · Music · Buy Seeds (853×1844 reference art). */
export const MOBILE_ARTBOARD_TAB_CHROME = {
  back: MOBILE_ARTBOARD_BACK_HOTSPOT,
  profileOrbSize: 32,
  actions: {
    left: "75%",
    top: "0.9%",
    width: "22%",
    height: "5.8%",
  },
  /** Hides baked PNG back / profile / menu so native chrome is identical on every tab. */
  bakedMask: {
    back: {
      left: "0%",
      top: "0%",
      width: "17%",
      height: "7.2%",
    },
    actions: {
      left: "71%",
      top: "0%",
      width: "29%",
      height: "7.2%",
    },
  },
} as const;

/** @deprecated Use MOBILE_ARTBOARD_TAB_CHROME */
export const MOBILE_ARTBOARD_853_CHROME = {
  back: MOBILE_ARTBOARD_TAB_CHROME.back,
  profile: {
    left: "76%",
    top: "0.9%",
    width: "9%",
    height: "5.8%",
  },
  menu: {
    left: "89.4%",
    top: "0.9%",
    width: "6.5%",
    height: "5.8%",
  },
  actions: MOBILE_ARTBOARD_TAB_CHROME.actions,
} as const;

/** @deprecated Use MOBILE_ARTBOARD_TAB_CHROME — buy-seeds uses the same tab row now. */
export const MOBILE_ARTBOARD_1080_CHROME = {
  back: MOBILE_ARTBOARD_TAB_CHROME.back,
  profile: {
    left: "76%",
    top: "0.9%",
    width: "9%",
    height: "5.8%",
  },
  menu: {
    left: "89.4%",
    top: "0.9%",
    width: "6.5%",
    height: "5.8%",
  },
  actions: MOBILE_ARTBOARD_TAB_CHROME.actions,
} as const;
