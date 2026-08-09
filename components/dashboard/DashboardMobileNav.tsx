"use client";

import Link from "next/link";
import AttendeeLiveNavLink from "@/components/navigation/AttendeeLiveNavLink";
import {
  ATTENDEE_PRIMARY_NAV,
  isAttendeePrimaryNavActive,
} from "@/lib/navigation/attendee-primary-nav";

/** Universal primary attendee dock — same five destinations at every viewport. */
export default function DashboardMobileNav({
  homeHref = "/my-convocation",
  pathname = "/my-convocation",
}: {
  homeHref?: string;
  pathname?: string;
}) {
  return (
    <nav className="cl-bottom-nav" aria-label="Primary">
      {ATTENDEE_PRIMARY_NAV.map((item) => {
        const Icon = item.icon;
        const href = item.match === "home" ? homeHref : item.href;
        const active = isAttendeePrimaryNavActive(pathname, item, homeHref);
        const className = `cl-bottom-nav__item${active ? " is-active" : ""}`;
        const content = (
          <>
            <span className="cl-bottom-nav__icon">
              <Icon aria-hidden="true" />
            </span>
            <span className="cl-bottom-nav__label">{item.label}</span>
          </>
        );

        if (item.id === "live") {
          return (
            <AttendeeLiveNavLink
              key={item.id}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={className}
            >
              {content}
            </AttendeeLiveNavLink>
          );
        }

        return (
          <Link
            key={item.id}
            href={href}
            className={className}
            aria-current={active ? "page" : undefined}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
