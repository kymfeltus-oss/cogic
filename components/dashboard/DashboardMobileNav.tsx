"use client";

import Link from "next/link";
import { CalendarDays, HandHeart, Home, Radio, Sparkles } from "lucide-react";

const items = [
  { label: "Home", href: "/my-convocation", icon: Home, kind: "home" as const },
  { label: "Watch Live", href: "/live", icon: Radio, kind: "prefix" as const },
  { label: "Program", href: "/program", icon: CalendarDays, kind: "prefix" as const },
  { label: "My Sanctuary", href: "/my-sanctuary", icon: Sparkles, kind: "exact" as const },
  { label: "Give", href: "/giving", icon: HandHeart, kind: "prefix" as const },
];

function isActive(
  pathname: string,
  homeHref: string,
  item: (typeof items)[number],
) {
  if (item.kind === "home") {
    return pathname === homeHref || pathname === "/my-convocation";
  }
  if (item.kind === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function DashboardMobileNav({
  homeHref = "/my-convocation",
  pathname = "/my-convocation",
}: {
  homeHref?: string;
  pathname?: string;
}) {
  return (
    <nav className="cl-bottom-nav" aria-label="Primary">
      {items.map((item) => {
        const Icon = item.icon;
        const href = item.kind === "home" ? homeHref : item.href;
        const active = isActive(pathname, homeHref, item);
        return (
          <Link
            key={item.label}
            href={href}
            className={`cl-bottom-nav__item${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="cl-bottom-nav__icon">
              <Icon aria-hidden="true" />
            </span>
            <span className="cl-bottom-nav__label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
