"use client";

import Link from "next/link";
import {
  ATTENDEE_DESKTOP_NAV,
  isAttendeeDesktopNavActive,
} from "@/lib/navigation/attendee-desktop-nav";

export default function AttendeeDesktopNav({
  pathname = "/my-convocation",
  homeHref = "/my-convocation",
  ariaLabel = "Primary",
}: {
  pathname?: string;
  homeHref?: string;
  ariaLabel?: string;
}) {
  return (
    <nav className="cl-topnav" aria-label={ariaLabel}>
      {ATTENDEE_DESKTOP_NAV.map((item) => {
        const href = item.match === "home" ? homeHref : item.href;
        const active = isAttendeeDesktopNavActive(pathname, item, homeHref);
        return (
          <Link
            key={item.label}
            href={href}
            className={active ? "is-active" : undefined}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
