/** Routes where global navigation is hidden (full-bleed cinematic / gate / live flows). */

const NAV_HIDDEN_EXACT = [
  "/",
  "/intro",
  "/login",
  "/create-account",
  "/test-suite",
  "/countdown",
] as const;

const NAV_HIDDEN_PREFIXES = [
  "/intro/",
  "/login/",
  "/create-account/",
  "/travel",
  "/live",
  "/watch",
  "/stream",
  "/studio",
  "/owner",
  "/email-gate",
  "/experience/live",
  "/dashboard/live",
  "/dashboard/countdown",
  "/countdown",
  "/graphics",
  "/c",
] as const;

function matchesHiddenPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

const MOBILE_ARTBOARD_TAB_EXACT = [
  "/music",
  "/program",
  "/digital-program",
  "/buy-seeds",
  "/contact-us",
  "/experience/contact-us",
] as const;

/** Bottom-nav artboard tabs — Live, Giving, Music, Buy Seeds (+ /live holding). */
export function isMobileArtboardTabRoute(pathname: string): boolean {
  return (MOBILE_ARTBOARD_TAB_EXACT as readonly string[]).includes(pathname);
}

/** Full-viewport PNG artboard routes — login, create-account, email-gate hub. */
export function isFullHeightArtboardRoute(pathname: string): boolean {
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return true;
  }

  if (pathname.includes("create-account")) {
    return true;
  }

  /** Fluid EmailGateShell form — must not use the locked h-dvh artboard shell. */
  if (pathname === "/email-gate/team") {
    return false;
  }

  return pathname === "/email-gate" || pathname.startsWith("/email-gate/");
}

export function isNavHiddenRoute(pathname: string): boolean {
  if ((NAV_HIDDEN_EXACT as readonly string[]).includes(pathname)) {
    return true;
  }

  if (pathname.includes("/create-account")) {
    return true;
  }

  if (pathname === "/c" || pathname.startsWith("/c/")) {
    return true;
  }

  return NAV_HIDDEN_PREFIXES.some((prefix) => matchesHiddenPrefix(pathname, prefix));
}

/** Public credential QR experience — isolated from attendee/admin chrome. */
export function isCredentialPublicRoute(pathname: string): boolean {
  return pathname === "/c" || pathname.startsWith("/c/");
}

/** @deprecated Use isNavHiddenRoute — kept for existing imports. */
export type NavHiddenRoute = string;

export {
  buildLiveStreamPath,
  buildSeedsCheckoutPath,
  buildSeedsHubPath,
  LIVE_STREAM_CLOSE_PATH,
  SEED_PACKAGES,
} from "@/lib/live-stream-routes";
export type { SeedPackageId } from "@/lib/live-stream-routes";
