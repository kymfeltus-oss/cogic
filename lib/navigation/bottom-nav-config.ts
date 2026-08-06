import { isAttendeeLiveSurfacePath } from "@/lib/experience/live-routes";
import { ATTENDEE_DASHBOARD_PATH } from "@/lib/navigation/back-to-dashboard";

export type BottomNavItemId =
  | "home"
  | "live"
  | "schedule"
  | "giving"
  | "replays";

export type BottomNavHotspot = {
  id: BottomNavItemId;
  label: string;
  href: string;
  isActive: (pathname: string) => boolean;
};

function matchesExact(path: string) {
  return (pathname: string) => pathname === path;
}

function matchesPrefix(path: string) {
  return (pathname: string) =>
    pathname === path || pathname.startsWith(`${path}/`);
}

/** Native-style tab bar height; phone safe area is added separately in CSS. */
export const BOTTOM_NAV_BAR_HEIGHT_PX = 56;

export const BOTTOM_NAV_HOTSPOTS: readonly BottomNavHotspot[] = [
  {
    id: "home",
    label: "Home",
    href: ATTENDEE_DASHBOARD_PATH,
    isActive: (pathname) =>
      pathname === ATTENDEE_DASHBOARD_PATH || pathname === "/attendee-dashboard",
  },
  {
    id: "live",
    label: "Watch Live",
    href: "/live",
    isActive: isAttendeeLiveSurfacePath,
  },
  {
    id: "schedule",
    label: "Schedule",
    href: "/program",
    isActive: matchesPrefix("/program"),
  },
  {
    id: "giving",
    label: "Giving",
    href: "/giving",
    isActive: matchesPrefix("/giving"),
  },
  {
    id: "replays",
    label: "Replays",
    href: "/replays",
    isActive: matchesPrefix("/replays"),
  },
] as const;
