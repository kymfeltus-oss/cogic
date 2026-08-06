import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Play, Radio } from "lucide-react";
import type { AttendeeDashboardData } from "@/lib/dashboard/load-attendee-dashboard";
import { chicagoDayGreeting, greetingName } from "@/lib/dashboard/greeting";

export default function DashboardHero({
  live,
  firstName,
}: {
  live: AttendeeDashboardData["live"];
  firstName?: string | null;
}) {
  const greeting = chicagoDayGreeting();
  const name = greetingName(firstName);
  const isLive = live.isLive;
  const headline = isLive
    ? live.title ?? "COGIC LIVE broadcast"
    : live.nextTitle ?? "118th Holy Convocation";
  const subline = isLive
    ? "Streaming now on COGIC LIVE"
    : live.nextTitle
      ? [live.nextTime, "Next on the published program"].filter(Boolean).join(" · ")
      : "Explore the published Convocation program";

  return (
    <section className="cl-hero" aria-label="Featured experience">
      <div className="cl-hero__media">
        <Image
          src="/my-sanctuary/banner.png"
          alt="118th Holy Convocation in St. Louis, Missouri, November 3–10, 2026"
          width={2172}
          height={724}
          priority
          quality={90}
          sizes="(max-width: 720px) 100vw, (max-width: 1180px) 90vw, 1100px"
          className="cl-hero__image"
        />
      </div>

      <div className="cl-hero__content">
        <p className="cl-hero__greeting">
          {greeting}
          {name ? `, ${name}` : ""}
        </p>
        <p className="cl-hero__welcome">Welcome to COGIC LIVE</p>

        <div className="cl-hero__status-row">
          {isLive ? (
            <span className="cl-pill cl-pill--live">
              <i className="cl-pill__pulse" aria-hidden="true" />
              Live now
            </span>
          ) : (
            <span className="cl-pill">Up next</span>
          )}
        </div>

        <h1 className="cl-hero__title">{headline}</h1>
        <p className="cl-hero__sub">{subline}</p>

        <div className="cl-hero__actions">
          <Link
            href={isLive ? "/live" : "/program"}
            className="cl-btn cl-btn--primary"
          >
            {isLive ? (
              <>
                <Play aria-hidden="true" className="size-4" />
                Watch Live
              </>
            ) : (
              <>
                <Radio aria-hidden="true" className="size-4" />
                View Program
              </>
            )}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          {!isLive && live.nextTitle ? (
            <Link href="/live" className="cl-btn cl-btn--ghost">
              Open Live Lobby
            </Link>
          ) : (
            <Link href="/program" className="cl-btn cl-btn--ghost">
              Explore Program
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
