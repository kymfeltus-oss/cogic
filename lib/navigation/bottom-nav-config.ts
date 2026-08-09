import {
  ATTENDEE_PRIMARY_NAV,
  isAttendeePrimaryNavActive,
  type AttendeePrimaryNavId,
} from "@/lib/navigation/attendee-primary-nav";

export type BottomNavItemId = AttendeePrimaryNavId;

export type BottomNavHotspot = {
  id: BottomNavItemId;
  label: string;
  href: string;
  isActive: (pathname: string) => boolean;
};

/** Native-style tab bar height; phone safe area is added separately in CSS. */
export const BOTTOM_NAV_BAR_HEIGHT_PX = 56;

/** Shared dock destinations — identical to the dashboard primary nav. */
export const BOTTOM_NAV_HOTSPOTS: readonly BottomNavHotspot[] = ATTENDEE_PRIMARY_NAV.map((item) => ({
  id: item.id,
  label: item.label,
  href: item.href,
  isActive: (pathname: string) => isAttendeePrimaryNavActive(pathname, item),
}));
