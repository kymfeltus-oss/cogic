import { CalendarDays, HandHeart, Home, Radio, Sparkles, type LucideIcon } from "lucide-react";
import { isAttendeeLiveSurfacePath } from "@/lib/experience/live-routes";
import { ATTENDEE_DASHBOARD_PATH } from "@/lib/navigation/back-to-dashboard";

export type AttendeePrimaryNavId =
  | "home"
  | "live"
  | "schedule"
  | "sanctuary"
  | "giving";

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
    id: "live",
    label: "Watch Live",
    href: "/live",
    icon: Radio,
    match: "live",
  },
  {
    id: "schedule",
    label: "Program",
    href: "/program",
    icon: CalendarDays,
    match: "prefix",
  },
  {
    id: "sanctuary",
    label: "My Sanctuary",
    href: "/my-sanctuary",
    icon: Sparkles,
    match: "exact",
  },
  {
    id: "giving",
    label: "Give",
    href: "/giving",
    icon: HandHeart,
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
