import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Church,
  HandHeart,
  Megaphone,
  Plane,
  UsersRound,
} from "lucide-react";
import DashboardHero from "@/components/dashboard/DashboardHero";
import DashboardLiveStage from "@/components/dashboard/DashboardLiveStage";
import type { AttendeeDashboardData } from "@/lib/dashboard/load-attendee-dashboard";

const utilities = [
  { title: "COGIC Travel", copy: "Book flights, hotels & more", href: "/travel", icon: Plane },
  { title: "Program", copy: "View full schedule & events", href: "/program", icon: CalendarDays },
  { title: "COGIC Giving", copy: "Give securely anytime", href: "/giving", icon: HandHeart },
  { title: "Registration", copy: "Register & manage your experience", href: "/register", icon: BadgeCheck },
  { title: "My Sanctuary", copy: "Your activities & favorites", href: "/my-sanctuary", icon: Church },
  { title: "Stay Informed", copy: "News, alerts & important updates", href: "/updates", icon: Megaphone },
  { title: "COGIC Social", copy: "Connect, engage & grow together", href: "/experience/live", icon: UsersRound },
] as const;

const highlightPlaceholders = [
  {
    id: "main-service",
    title: "Main Service",
    meta: "Official COGIC LIVE programming",
    href: "/live",
    imageUrl: "/my-sanctuary/convocation-banner-bishops-v2.png",
  },
  {
    id: "revival-fire",
    title: "Revival Fire",
    meta: "Convocation messages and replays",
    href: "/replays",
    imageUrl: "/my-sanctuary/menu-bar-background.png",
  },
  {
    id: "musical",
    title: "The Musical",
    meta: "COGIC worship and music",
    href: "/music",
    imageUrl: "/music/hallelujah-anyhow-cover.png",
  },
] as const;

export default function MobileDashboardHome({ data }: { data: AttendeeDashboardData }) {
  return (
    <main id="mobile-main-content" className="cl-mobile-home">
      <DashboardHero />
      <DashboardLiveStage live={data.live} />

      <nav className="cl-mobile-utilities" aria-label="COGIC LIVE features">
        {utilities.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.title} href={item.href} className="cl-mobile-utility">
              <Icon aria-hidden="true" />
              <strong>{item.title}</strong>
              <span>{item.copy}</span>
              <i aria-hidden="true"><ArrowRight /></i>
            </Link>
          );
        })}
      </nav>

      <section className="cl-mobile-highlights" aria-labelledby="cl-mobile-highlights-heading">
        <header>
          <h2 id="cl-mobile-highlights-heading">Highlights</h2>
          <Link href="/replays">View all <ArrowRight aria-hidden="true" /></Link>
        </header>
        <div className="cl-mobile-highlights__rail">
          {highlightPlaceholders.map((item) => (
            <Link key={item.id} href={item.href} className="cl-mobile-highlight">
              {/* Local, curated placeholder art for real downstream destinations. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt="" loading="lazy" />
              <span className="cl-mobile-highlight__shade" />
              <span className="cl-mobile-highlight__copy">
                <strong>{item.title}</strong>
                <small>{item.meta}</small>
              </span>
              <i aria-hidden="true"><ArrowRight /></i>
            </Link>
          ))}
          {data.recentReplays.map((replay) => (
              <Link key={replay.id} href={`/replays/${encodeURIComponent(replay.id)}`} className="cl-mobile-highlight">
                {replay.thumbnailUrl ? (
                  // Owner-managed replay art may use a remote storage host.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={replay.thumbnailUrl} alt="" loading="lazy" />
                ) : <span className="cl-mobile-highlight__fallback" aria-hidden="true" />}
                <span className="cl-mobile-highlight__shade" />
                <span className="cl-mobile-highlight__copy">
                  <strong>{replay.title}</strong>
                  <small>{replay.localDate}</small>
                </span>
                <i aria-hidden="true"><ArrowRight /></i>
              </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
