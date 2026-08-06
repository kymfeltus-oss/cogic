/** Canonical COGIC LIVE attendee hub — bottom nav Home + post-login destination. */
export const ATTENDEE_DASHBOARD_PATH = "/my-convocation" as const;

/** Legacy Awakening artboard route — kept only for redirects/profile deep links. */
export const LEGACY_ATTENDEE_DASHBOARD_PATH = "/attendee-dashboard" as const;

/** Shared top-left control on mobile artboard PNGs (Live · Giving · Music · Buy Seeds). */
export const MOBILE_ARTBOARD_BACK_HOTSPOT = {
  label: "Back to dashboard",
  left: "2.5%",
  top: "0.9%",
  width: "10.5%",
  height: "5.8%",
} as const;
