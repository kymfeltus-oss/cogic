"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  CircleHelp,
  HandHeart,
  Home,
  IdCard,
  Radio,
  Sparkles,
  Video,
} from "lucide-react";

const items = [
  { label: "Home", href: "/my-convocation", icon: Home, match: "home" },
  { label: "Watch Live", href: "/live", icon: Radio, match: "prefix" },
  { label: "Program", href: "/program", icon: CalendarDays, match: "prefix" },
  { label: "My Sanctuary", href: "/my-sanctuary", icon: Sparkles, match: "exact" },
  { label: "Give", href: "/giving", icon: HandHeart, match: "prefix" },
  { label: "Registration", href: "/register", icon: IdCard, match: "prefix" },
  { label: "Replays", href: "/replays", icon: Video, match: "exact" },
] as const;

function isActive(pathname: string, homeHref: string, item: (typeof items)[number]) {
  if (item.match === "home") {
    return pathname === homeHref || pathname === "/my-convocation";
  }
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function DashboardSidebar({
  homeHref = "/my-convocation",
  pathname = "/my-convocation",
}: {
  homeHref?: string;
  pathname?: string;
}) {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

  return (
    <aside className="cl-sidebar" aria-label="Dashboard navigation">
      <Link href={homeHref} className="cl-sidebar__brand" aria-label="COGIC LIVE home">
        <Image
          src="/my-sanctuary/cogic-live-logo-purple.png"
          alt="COGIC LIVE"
          width={1250}
          height={270}
          priority
          sizes="200px"
          className="cogic-wordmark__image"
        />
      </Link>

      <nav className="cl-sidebar__nav">
        {items.map((item) => {
          const Icon = item.icon;
          const href = item.match === "home" ? homeHref : item.href;
          const active = isActive(pathname, homeHref, item);
          return (
            <Link
              key={item.label}
              href={href}
              className={`cl-sidebar__link${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {supportEmail ? (
        <a className="cl-sidebar__help" href={`mailto:${supportEmail}`}>
          <CircleHelp aria-hidden="true" />
          <span>
            <strong>Need help?</strong>
            <small>Contact support</small>
          </span>
        </a>
      ) : null}

      <div className="cl-sidebar__event max-[1180px]:hidden" aria-label="118th Holy Convocation">
        <strong>118TH HOLY<br />CONVOCATION</strong>
        <b>ST. LOUIS, MO</b>
        <small>NOVEMBER 3–10, 2026</small>
      </div>
    </aside>
  );
}
