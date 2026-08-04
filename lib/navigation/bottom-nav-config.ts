import { isAttendeeLiveSurfacePath } from "@/lib/experience/live-routes";
import { ATTENDEE_DASHBOARD_PATH } from "@/lib/navigation/back-to-dashboard";

export type BottomNavItemId =
  | "home"
  | "live"
  | "giving"
  | "music"
  | "buy-seeds";

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
    isActive: matchesExact(ATTENDEE_DASHBOARD_PATH),
  },
  {
    id: "live",
    label: "Live",
    href: "/live",
    isActive: isAttendeeLiveSurfacePath,
  },
  {
    id: "giving",
    label: "Giving",
    href: "/giving",
    isActive: matchesPrefix("/giving"),
  },
  {
    id: "music",
    label: "Music",
    href: "/music",
    isActive: matchesPrefix("/music"),
  },
  {
    id: "buy-seeds",
    label: "Buy Seeds",
    href: "/buy-seeds",
    isActive: matchesPrefix("/buy-seeds"),
  },
] as const;
