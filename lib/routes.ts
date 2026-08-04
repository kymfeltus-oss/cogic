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
] as const;

function matchesHiddenPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

const MOBILE_ARTBOARD_TAB_EXACT = [
  "/music",
  "/giving",
  "/experience/giving",
  "/program",
  "/buy-seeds",
  "/live",
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

  return NAV_HIDDEN_PREFIXES.some((prefix) => matchesHiddenPrefix(pathname, prefix));
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
