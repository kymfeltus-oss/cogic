"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useRef } from "react";
import {
  Archive,
  CalendarDays,
  ChevronDown,
  Church,
  Library,
  Megaphone,
  Play,
  PlaySquare,
  Radio,
  Search,
  Sprout,
  TicketCheck,
  UserRound,
} from "lucide-react";
import { usePathname } from "next/navigation";
import DashboardMobileNav from "@/components/dashboard/DashboardMobileNav";
import AttendeeDesktopNav from "@/components/navigation/AttendeeDesktopNav";
import LiveMonetizationPanel from "@/components/live/hub/LiveMonetizationPanel";
import LiveExperienceClient from "@/components/experience/live/LiveExperienceClient";
import LiveRoomChatPanel from "@/components/experience/live/LiveRoomChatPanel";
import LiveShareButton from "@/components/live/LiveShareButton";
import type { LiveHubData } from "@/lib/live/load-live-hub";
import { resolveAttendeeMediaState } from "@/lib/live/attendee-media-state";

type LiveHubClientProps = { data: LiveHubData };

function MediaCard({ href, kicker, title, copy, thumbnailUrl }: {
  href: string;
  kicker: string;
  title: string;
  copy?: string | null;
  thumbnailUrl?: string | null;
}) {
  return (
    <Link href={href} className="live-hub__card">
      {thumbnailUrl ? (
        <span className="live-hub__card-media">
          {/* Remote replay artwork is operator-managed and may not use Next image hosts. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbnailUrl} alt="" loading="lazy" />
          <Play aria-hidden="true" />
        </span>
      ) : null}
      <span className="live-hub__card-body">
        <span className="live-hub__card-kicker">{kicker}</span>
        <span className="live-hub__card-title">{title}</span>
        {copy ? <span className="live-hub__card-copy">{copy}</span> : null}
      </span>
    </Link>
  );
}

function SectionHeading({ id, title, href, action }: { id: string; title: string; href?: string; action?: string }) {
  return (
    <div className="live-hub__section-head">
      <h2 id={id}>{title}</h2>
      {href ? <Link href={href}>{action ?? "View all"}</Link> : null}
    </div>
  );
}

export default function LiveHubClient({ data }: LiveHubClientProps) {
  const pathname = usePathname() || "/live";
  const playerAnchorRef = useRef<HTMLDivElement>(null);
  const givingAnchorRef = useRef<HTMLDivElement>(null);

  const scrollToPlayer = useCallback(() => {
    playerAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const video = document.querySelector<HTMLVideoElement>("#live-hub-player video");
    if (video) void video.play().catch(() => undefined);
  }, []);

  const scrollToGiving = useCallback(() => {
    givingAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const mediaState = resolveAttendeeMediaState(data.isLive, data.featuredReplay);
  const featuredReplay = mediaState.kind === "replay" ? data.featuredReplay : null;
  const hasPlayableReplay = mediaState.kind === "replay";
  const serviceTitle = data.currentService?.title
    ?? featuredReplay?.title
    ?? (data.isLive ? "COGIC LIVE Broadcast" : "Currently Offline");
  const serviceCopy = data.currentService
    ? [data.currentService.eventType.replaceAll("_", " "), data.currentService.venueLabel, data.currentService.localDate]
        .filter(Boolean).join(" · ")
    : data.isLive
      ? "Live broadcast in progress."
      : featuredReplay
        ? [featuredReplay.localDate, featuredReplay.description].filter(Boolean).join(" · ")
        : "Programming will appear here as soon as it is available.";
  const attendeeName = data.profile.firstName || "Guest";

  return (
    <div className="live-hub">
      <header className="live-hub__topbar">
        <Link href="/my-convocation" className="live-hub__brand" aria-label="COGIC LIVE dashboard">
          <Image src="/branding/cogic-seal.png" alt="" width={58} height={58} priority />
          <span>
            <Image src="/my-sanctuary/cogic-live-logo-purple.png" alt="COGIC LIVE" width={1250} height={270} priority />
            <small>Cinematic immersive hub</small>
          </span>
        </Link>

        <AttendeeDesktopNav pathname={pathname} ariaLabel="Live Hub navigation" />

        <div className="live-hub__account">
          <Link href="/replays" aria-label="Search published media"><Search aria-hidden="true" /></Link>
          <Link href="/my-convocation?view=profile" className="live-hub__profile">
            <span className="live-hub__avatar">
              {data.profile.avatarUrl ? (
                <Image src={data.profile.avatarUrl} alt="" width={38} height={38} unoptimized />
              ) : <UserRound aria-hidden="true" />}
            </span>
            <span><strong>{attendeeName}</strong><small>Attendee</small></span>
            <ChevronDown aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main className="live-hub__inner">
        <div className="live-hub__top-grid">
          <section className="live-hub__stage" aria-labelledby="live-hub-service-heading">
            <div className="live-hub__stage-head">
              <span className={`live-hub__status${data.isLive ? " live-hub__status--live" : hasPlayableReplay ? " live-hub__status--playing" : ""}`} aria-live="polite">
                {mediaState.badge}
              </span>
              <span className="live-hub__authority">Official COGIC broadcast</span>
            </div>

            <div id="live-hub-player" ref={playerAnchorRef} className="live-hub__player-shell">
              {data.isLive ? (
                <LiveExperienceClient initialProfile={data.profile} variant="hub" />
              ) : hasPlayableReplay && featuredReplay ? (
                <video
                  src={featuredReplay.playbackUrl}
                  poster={featuredReplay.thumbnailUrl ?? undefined}
                  title={featuredReplay.title}
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : (
                <div className="live-hub__offline">
                  <Radio aria-hidden="true" />
                  <strong>Currently Offline</strong>
                  <span>Programming will appear here when it is available.</span>
                </div>
              )}
            </div>

            <div className="live-hub__service-bar">
              <div>
                <p className="live-hub__eyebrow">118th Holy Convocation</p>
                <h1 id="live-hub-service-heading">{serviceTitle}</h1>
                <p>{serviceCopy}</p>
              </div>
              <div className="live-hub__actions">
                {data.isLive || hasPlayableReplay ? (
                  <button type="button" className="live-hub__btn live-hub__btn--primary" onClick={scrollToPlayer}>
                    <Play aria-hidden="true" /> {mediaState.cta}
                  </button>
                ) : null}
                <button type="button" className="live-hub__btn live-hub__btn--secondary" onClick={scrollToGiving}>
                  <Sprout aria-hidden="true" /> Sow Now
                </button>
                <LiveShareButton className="live-hub__btn live-hub__btn--ghost" label="Share" />
              </div>
              <div className="live-hub__service-links">
                <Link href="/program"><CalendarDays aria-hidden="true" /> Order of Service</Link>
                <Link href="/replays"><Radio aria-hidden="true" /> Replays</Link>
                <Link href="/my-sanctuary"><Library aria-hidden="true" /> My Library</Link>
              </div>
            </div>
          </section>

          <aside className="live-hub__side-rail" aria-label="Live engagement tools">
            {data.authenticated ? (
              <section className="live-hub__panel live-hub__chat" aria-labelledby="live-hub-chat-heading">
                <SectionHeading id="live-hub-chat-heading" title="Live Chat" />
                <LiveRoomChatPanel enabled />
              </section>
            ) : null}

            <section ref={givingAnchorRef} id="live-hub-giving" className="live-hub__panel live-hub__giving" aria-labelledby="live-hub-giving-heading">
              <SectionHeading id="live-hub-giving-heading" title="Support & Seeds" />
              <LiveMonetizationPanel seedBalance={data.authenticated ? data.seedBalance : null} />
            </section>

            <section className="live-hub__panel live-hub__up-next" aria-labelledby="live-hub-upnext-heading">
              <SectionHeading id="live-hub-upnext-heading" title="Up Next" href="/program" action="View schedule" />
              {data.upNext.length === 0 ? (
                <p className="live-hub__empty">No upcoming published broadcasts.</p>
              ) : (
                <div className="live-hub__rail">
                  {data.upNext.slice(0, 2).map((item) => (
                    <MediaCard key={item.occurrenceKey} href="/program" kicker={item.timeLabel} title={item.title}
                      copy={[item.eventType.replaceAll("_", " "), item.venueLabel].filter(Boolean).join(" · ") || null} />
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>

        <div className="live-hub__media-dashboard">
          {data.authenticated ? (
            <section className="live-hub__section live-hub__section--wide" aria-labelledby="live-hub-continue-heading">
              <SectionHeading id="live-hub-continue-heading" title="Continue Watching" href="/replays" action="View all" />
              {data.continueWatching.length === 0 && data.watchHistory.length === 0 ? <p className="live-hub__empty">No in-progress replays yet.</p> : (
                <div className="live-hub__rail live-hub__rail--media">
                  {data.continueWatching.slice(0, 3).map((replay) => <MediaCard key={replay.id} href={`/replays/${encodeURIComponent(replay.id)}`} kicker="Resume replay" title={replay.title} copy={replay.localDate} thumbnailUrl={replay.thumbnailUrl} />)}
                  {data.continueWatching.length === 0 ? data.watchHistory.slice(0, 3).map((item) => <MediaCard key={item.replay.id} href={`/replays/${encodeURIComponent(item.replay.id)}`} kicker={item.completed ? "Completed" : "Resume"} title={item.replay.title} copy={item.replay.localDate} thumbnailUrl={item.replay.thumbnailUrl} />) : null}
                </div>
              )}
            </section>
          ) : null}

          <section className="live-hub__section live-hub__section--wide" aria-labelledby="live-hub-replays-heading">
            <SectionHeading id="live-hub-replays-heading" title="Recent Replays" href="/replays" action="View all" />
            {data.recentReplays.length === 0 ? <p className="live-hub__empty">No published replays are available yet.</p> : (
              <div className="live-hub__rail live-hub__rail--media">
                {data.recentReplays.slice(0, 3).map((replay) => <MediaCard key={replay.id} href={`/replays/${encodeURIComponent(replay.id)}`} kicker="Watch replay" title={replay.title} copy={replay.localDate} thumbnailUrl={replay.thumbnailUrl} />)}
              </div>
            )}
          </section>

          {data.authenticated ? (
            <section className="live-hub__section" aria-labelledby="live-hub-saved-heading">
              <SectionHeading id="live-hub-saved-heading" title="Saved" href="/replays" action="View all" />
              {data.favorites.length === 0 ? <p className="live-hub__empty">No saved replays yet.</p> : (
                <div className="live-hub__rail">{data.favorites.slice(0, 2).map((replay) => <MediaCard key={replay.id} href={`/replays/${encodeURIComponent(replay.id)}`} kicker="Saved" title={replay.title} copy={replay.localDate} thumbnailUrl={replay.thumbnailUrl} />)}</div>
              )}
            </section>
          ) : null}

          <section className="live-hub__section" aria-labelledby="live-hub-archives-heading">
            <div className="live-hub__section-head"><h2 id="live-hub-archives-heading">Archives / Collections</h2><Archive aria-hidden="true" /></div>
            {data.archives.length === 0 ? <p className="live-hub__empty">No published archives are available yet.</p> : (
              <div className="live-hub__rail">{data.archives.map((archive) => <MediaCard key={archive.id} href={`/replays/archive/${encodeURIComponent(archive.slug)}`} kicker={`${archive.year}`} title={archive.title} copy={archive.description} />)}</div>
            )}
          </section>
        </div>

        <footer className="live-hub__convocation-dock" aria-label="My Convocation">
          <section className="live-hub__convocation-tools">
            <h2>My Convocation</h2>
            <nav aria-label="Convocation tools">
              <Link href="/program"><CalendarDays aria-hidden="true" /><span><strong>Schedule</strong><small>View full schedule</small></span></Link>
              <Link href="/register"><TicketCheck aria-hidden="true" /><span><strong>Registration</strong><small>Manage registration</small></span></Link>
              <Link href="/replays"><PlaySquare aria-hidden="true" /><span><strong>Replays</strong><small>Watch published media</small></span></Link>
              <Link href="/my-sanctuary"><Church aria-hidden="true" /><span><strong>My Sanctuary</strong><small>Open your space</small></span></Link>
              <Link href="/updates"><Megaphone aria-hidden="true" /><span><strong>Announcements</strong><small>Latest updates</small></span></Link>
            </nav>
          </section>

          <section className="live-hub__convocation-promo">
            <div className="live-hub__convocation-promo-art" aria-hidden="true" />
            <Image src="/branding/cogic-seal.png" alt="" width={52} height={52} />
            <span><strong>118th Holy Convocation</strong><small>November 3–10, 2026 · St. Louis, Missouri</small></span>
            <Link href="/program">Learn more</Link>
          </section>
        </footer>
      </main>

      <DashboardMobileNav homeHref="/my-convocation" pathname={pathname} />
    </div>
  );
}
