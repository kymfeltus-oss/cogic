import Link from "next/link";
import { ArrowRight, Building2, Ticket } from "lucide-react";
import DashboardLiveStage from "@/components/dashboard/DashboardLiveStage";
import TodayScheduleCard from "@/components/dashboard/TodayScheduleCard";
import StayConnectedPrompt from "@/components/notifications/StayConnectedPrompt";
import { DASHBOARD_UTILITIES } from "@/lib/dashboard/dashboard-utilities";
import type { AttendeeDashboardData } from "@/lib/dashboard/load-attendee-dashboard";

/** Canonical attendee dashboard — same composition at every viewport. */
export default function AttendeeDashboardHome({
  data,
  signedIn = false,
}: {
  data: AttendeeDashboardData;
  signedIn?: boolean;
}) {
  const highlightItems =
    data.recentReplays.length > 0
      ? data.recentReplays.slice(0, 4).map((replay) => ({
          id: replay.id,
          title: replay.title,
          meta: "Published replay",
          href: `/replays/${encodeURIComponent(replay.id)}`,
          imageUrl: replay.thumbnailUrl || "/my-sanctuary/menu-bar-background.png",
        }))
      : [
          {
            id: "live-hub",
            title: "COGIC LIVE Hub",
            meta: "Open live programming and replays",
            href: "/live",
            imageUrl: "/my-sanctuary/menu-bar-background.png",
          },
          {
            id: "program",
            title: "Convocation Program",
            meta: "Browse the published schedule",
            href: "/program",
            imageUrl: "/my-sanctuary/convocation-banner-bishops-v2.png",
          },
        ];

  const ticketsHref = !signedIn
    ? "/login?next=%2Ftickets"
    : data.tickets.error
      ? "/my-convocation"
      : "/tickets";
  const housingHref = !signedIn
    ? "/login?next=%2Fhousing"
    : data.housing.error
      ? "/my-convocation"
      : "/housing";

  return (
    <main id="main-content" className="cl-mobile-home">
      <DashboardLiveStage live={data.live} />

      <nav className="cl-dashboard-feature-suite" aria-label="COGIC LIVE features">
        {DASHBOARD_UTILITIES.map((item) => {
          const Icon = item.icon;
          const isSocial = item.title === "COGIC Connect";
          return (
            <Link
              key={item.title}
              href={item.href}
              className={`cl-dashboard-feature-card${isSocial ? " cl-dashboard-feature-card--social" : ""}`}
            >
              <span className="cl-dashboard-feature-card__icon" aria-hidden="true">
                <Icon />
              </span>
              <span className="cl-dashboard-feature-card__copy">
                <strong>{item.title}</strong>
                <small>{item.copy}</small>
              </span>
              <i aria-hidden="true">
                <ArrowRight />
              </i>
            </Link>
          );
        })}
      </nav>

      {data.scheduleError ? (
        <p className="cl-module-error" role="alert">
          Unable to load schedule. Try again.
        </p>
      ) : (
        <TodayScheduleCard
          schedule={data.schedule}
          scheduleAvailable={data.scheduleAvailable}
        />
      )}

      <section className="cl-dashboard-highlights" aria-labelledby="cl-dashboard-highlights-heading">
        <header>
          <h2 id="cl-dashboard-highlights-heading">
            {data.recentReplays.length > 0 ? "Replays" : "Explore"}
          </h2>
          <Link href={data.recentReplays.length > 0 ? "/replays" : "/program"}>
            View all <ArrowRight aria-hidden="true" />
          </Link>
        </header>
        <div className="cl-dashboard-highlights__rail">
          {highlightItems.map((item) => (
            <Link key={item.id} href={item.href} className="cl-dashboard-highlight">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt="" loading="lazy" />
              <span className="cl-dashboard-highlight__shade" />
              <span className="cl-dashboard-highlight__copy">
                <strong>{item.title}</strong>
                <small>{item.meta}</small>
              </span>
              <i aria-hidden="true">
                <ArrowRight />
              </i>
            </Link>
          ))}
        </div>
      </section>

      <section className="cl-dashboard-account-cards" aria-label="My convocation details">
        {data.tickets.error ? (
          <div className="cl-dashboard-account-card" role="alert">
            <span className="cl-dashboard-account-card__icon" aria-hidden="true">
              <Ticket />
            </span>
            <span className="cl-dashboard-account-card__body">
              <small>Event admission</small>
              <strong>My Tickets</strong>
              <em>{data.tickets.summary}</em>
            </span>
            <Link href={ticketsHref} className="cl-dashboard-account-card__action">
              {data.tickets.cta} <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <Link href={ticketsHref} className="cl-dashboard-account-card">
            <span className="cl-dashboard-account-card__icon" aria-hidden="true">
              <Ticket />
            </span>
            <span className="cl-dashboard-account-card__body">
              <small>Event admission</small>
              <strong>My Tickets</strong>
              <em>{data.tickets.summary}</em>
            </span>
            <span className="cl-dashboard-account-card__action">
              {data.tickets.cta} <ArrowRight aria-hidden="true" />
            </span>
          </Link>
        )}
        {data.housing.error ? (
          <div
            className="cl-dashboard-account-card cl-dashboard-account-card--housing"
            role="alert"
          >
            <span className="cl-dashboard-account-card__icon" aria-hidden="true">
              <Building2 />
            </span>
            <span className="cl-dashboard-account-card__body">
              <small>Accommodation</small>
              <strong>My Housing</strong>
              <em>{data.housing.summary}</em>
            </span>
            <Link href={housingHref} className="cl-dashboard-account-card__action">
              {data.housing.cta} <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <Link
            href={housingHref}
            className="cl-dashboard-account-card cl-dashboard-account-card--housing"
          >
            <span className="cl-dashboard-account-card__icon" aria-hidden="true">
              <Building2 />
            </span>
            <span className="cl-dashboard-account-card__body">
              <small>Accommodation</small>
              <strong>My Housing</strong>
              <em>{data.housing.summary}</em>
            </span>
            <span className="cl-dashboard-account-card__action">
              {data.housing.cta} <ArrowRight aria-hidden="true" />
            </span>
          </Link>
        )}
      </section>

      <StayConnectedPrompt signedIn={signedIn} />
    </main>
  );
}
