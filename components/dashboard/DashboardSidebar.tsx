import Link from "next/link";
import { CalendarDays, CircleHelp, HandHeart, Home, IdCard, Play, Radio, Video } from "lucide-react";

const items = [
  ["Home", "/my-convocation", Home],
  ["Watch Live", "/live", Radio],
  ["Schedule", "/program", CalendarDays],
  ["My Convocation", "/register", IdCard],
  ["Giving", "/giving", HandHeart],
  ["Replays", "/replays", Video],
] as const;

export default function DashboardSidebar({ homeHref = "/my-convocation" }: { homeHref?: string }) {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  return (
    <aside className="cogic-sidebar" aria-label="Dashboard navigation">
      <Link href={homeHref} className="cogic-wordmark" aria-label="COGIC LIVE home">
        <span>COGIC</span><strong><Play aria-hidden="true" />LIVE</strong>
      </Link>
      <nav className="cogic-sidebar__nav">
        {items.map(([label, href, Icon], index) => (
          <Link key={label} href={index === 0 ? homeHref : href} className={`cogic-sidebar__link${index === 0 ? " is-active" : ""}`} aria-current={index === 0 ? "page" : undefined}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      {supportEmail ? (
        <a className="cogic-help" href={`mailto:${supportEmail}`}>
          <CircleHelp aria-hidden="true" />
          <span><strong>Need Help?</strong><small>Visit our Help Center</small></span>
        </a>
      ) : null}
    </aside>
  );
}
