/** Shared responsive layout tokens for COGIC LIVE */

/** Effect tier utility classes — pair with globals.css `.effects-heavy` / `.effects-lite` */
export const EFFECTS_TIER = {
  heavy: "effects-heavy",
  lite: "effects-lite",
} as const;

export const SHELL = {
  mobile: "app-shell",
  wide: "app-shell-wide",
  full: "app-shell-full",
} as const;

export type ShellVariant = keyof typeof SHELL;

/** Fluid shell width classes — edge-to-edge, no phone-frame caps */
export const SHELL_MAX_CLASS: Record<ShellVariant, string> = {
  mobile: "w-full px-4",
  wide: "w-full px-6",
  full: "w-full px-8",
};

/** Standard 12-column page grid for desktop multi-column layouts */
export const PAGE_GRID =
  "grid w-full grid-cols-1 gap-4 md:grid-cols-12 md:gap-6";

/** Locks immersive shells to the dynamic viewport (mobile browser chrome safe) */
export const DEVICE_FIT_VIEWPORT =
  "h-dvh max-h-dvh min-h-0 w-full max-w-[100vw] overflow-hidden";

/** Standard page root — full device width, at least one viewport tall */
export const DEVICE_FIT_PAGE =
  "min-h-dvh w-full max-w-[100vw] overflow-x-hidden";

/** Scrollable main column inside a full-height device-fit grid */
export const DEVICE_FIT_SCROLL =
  "min-h-0 h-dvh max-h-dvh overflow-y-auto overflow-x-hidden";

/** Event lobby grid — fluid side rails from tablet landscape up */
export const LOBBY_GRID =
  "grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(14rem,260px)_minmax(0,1fr)_minmax(16rem,360px)]";

/** 9:16 mobile app content track — locked; do not switch to 100vw (dashboard + bottom dock). */
export const MOBILE_APP_TRACK_WIDTH =
  "min(100vw, calc((100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) * 1080 / 1920))" as const;

/** Tab content track — viewport minus bottom dock + safe areas (Giving · Music · Buy Seeds · Prayer). */
export const MOBILE_TAB_TRACK_WIDTH =
  "min(100vw, calc((100dvh - var(--bottom-dock-display-h, 56px) - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) * 1080 / 1920))" as const;

/** Reference artboard — every PNG/tab page uses this same stage as `/attendee-dashboard`. */
export const MOBILE_ARTBOARD_REF = {
  width: 1080,
  height: 1920,
} as const;

export type MobileArtboardSize = {
  width: number;
  height: number;
};

/** Shared `--mobile-art-w` / `--mobile-art-h` for stage height (always dashboard ref). */
export function mobileArtboardVars(size: MobileArtboardSize = MOBILE_ARTBOARD_REF): Record<string, number> {
  return {
    "--mobile-art-w": size.width,
    "--mobile-art-h": size.height,
  };
}

/** Stage inline style — locked 1080×1920 column (same size as dashboard). */
export function mobileArtboardStageStyle(options?: {
  /** @deprecated Ignored — all pages use MOBILE_ARTBOARD_REF stage size. */
  native?: MobileArtboardSize;
  extra?: Record<string, string | number>;
}): Record<string, string | number> {
  return {
    ...mobileArtboardVars(MOBILE_ARTBOARD_REF),
    "--mobile-art-native-w": MOBILE_ARTBOARD_REF.width,
    "--mobile-art-native-h": MOBILE_ARTBOARD_REF.height,
    ...options?.extra,
  };
}

/** Shared page shell + stage classes for bottom-nav artboard tabs. */
export const MOBILE_ARTBOARD_TAB_SHELL = "mobile-artboard-tab-shell";
export const MOBILE_ARTBOARD_TAB_STAGE = "mobile-artboard-tab-shell__stage";

/** Dashboard-matched horizontal inset for tab overlays (40px @ 1080 artboard). */
export const MOBILE_TAB_CONTENT_INSET_LEFT = "calc(40 / 1080 * 100%)";
export const MOBILE_TAB_CONTENT_WIDTH = "calc(100% - 2 * 40 / 1080 * 100%)";
export const MOBILE_ARTBOARD_TAB_CONTENT_OVERLAY = "mobile-artboard-tab-content-overlay";

/** Full-viewport artboard shell — login, create-account, email-gate, live holding. */
export const MOBILE_ARTBOARD_FULL_SHELL = "mobile-artboard-full-shell";
export const MOBILE_ARTBOARD_STAGE = "mobile-artboard-stage";
export const MOBILE_ARTBOARD_ART_FIT = "mobile-artboard-art-fit";

/** Content offset when PNG bottom dock is present (display height + safe area). */
export const CONTENT_WITH_NAV =
  "pb-[calc(var(--bottom-dock-display-h,56px)+env(safe-area-inset-bottom))]";

/** Dashboard card grid — scales with viewport */
export const CARD_GRID_DASHBOARD =
  "grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6";

/** General responsive card grid */
export const CARD_GRID_RESPONSIVE =
  "grid grid-cols-1 gap-[clamp(0.5rem,2vw,1rem)] sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

export function getParticleBudget(width: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  if (width < 480) return 50;
  if (width < 1024) return 90;
  return 130;
}
