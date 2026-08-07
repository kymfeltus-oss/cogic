export type AttendeeDesktopNavItem = {
  label: string;
  href: string;
  match: "home" | "exact" | "prefix";
};

/** Desktop top-nav destinations shared across attendee chrome (except Travel Hub). */
export const ATTENDEE_DESKTOP_NAV: readonly AttendeeDesktopNavItem[] = [
  { label: "Home", href: "/my-convocation", match: "home" },
  { label: "Live", href: "/live", match: "prefix" },
  { label: "Replays", href: "/replays", match: "prefix" },
  { label: "Program", href: "/program", match: "prefix" },
  { label: "Travel", href: "/travel", match: "prefix" },
  { label: "Give", href: "/giving", match: "prefix" },
  { label: "Registration", href: "/register", match: "prefix" },
  { label: "My Sanctuary", href: "/my-sanctuary", match: "exact" },
] as const;

export function isAttendeeDesktopNavActive(
  pathname: string,
  item: AttendeeDesktopNavItem,
  homeHref = "/my-convocation",
) {
  if (item.match === "home") {
    return pathname === homeHref || pathname === "/my-convocation";
  }
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function isTravelHubRoute(pathname: string | null | undefined) {
  const path = pathname || "/";
  return path === "/travel" || path.startsWith("/travel/") || path === "/my-convocation/travel";
}
