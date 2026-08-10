import { ClipboardList, HandHeart, Home, Plane, Radio, type LucideIcon } from "lucide-react";
import { isAttendeeLiveSurfacePath } from "@/lib/experience/live-routes";
import { ATTENDEE_DASHBOARD_PATH } from "@/lib/navigation/back-to-dashboard";

export type AttendeePrimaryNavId =
  | "home"
  | "registration"
  | "live"
  | "giving"
  | "travel";

export type AttendeePrimaryNavItem = {
  id: AttendeePrimaryNavId;
  label: string;
  href: string;
  icon: LucideIcon;
  match: "home" | "exact" | "prefix" | "live";
};

/** Canonical primary attendee navigation — approved mobile dock at every viewport. */
export const ATTENDEE_PRIMARY_NAV: readonly AttendeePrimaryNavItem[] = [
  {
    id: "home",
    label: "Home",
    href: ATTENDEE_DASHBOARD_PATH,
    icon: Home,
    match: "home",
  },
  {
    id: "registration",
    label: "Registration",
    href: "/register",
    icon: ClipboardList,
    match: "prefix",
  },
  {
    id: "live",
    label: "COGIC Live",
    href: "/live",
    icon: Radio,
    match: "live",
  },
  {
    id: "giving",
    label: "Giving",
    href: "/giving",
    icon: HandHeart,
    match: "prefix",
  },
  {
    id: "travel",
    label: "Travel",
    href: "/travel",
    icon: Plane,
    match: "prefix",
  },
] as const;

export function isAttendeePrimaryNavActive(
  pathname: string,
  item: AttendeePrimaryNavItem,
  homeHref: string = ATTENDEE_DASHBOARD_PATH,
) {
  if (item.match === "home") {
    return pathname === homeHref || pathname === ATTENDEE_DASHBOARD_PATH || pathname === "/attendee-dashboard";
  }
  if (item.match === "live") return isAttendeeLiveSurfacePath(pathname);
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
