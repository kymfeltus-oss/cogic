import Image from "next/image";
import Link from "next/link";
import { Play, Radio } from "lucide-react";
import type { AttendeeDashboardData } from "@/lib/dashboard/load-attendee-dashboard";

/**
 * Status badge is driven by authoritative live state from the dashboard loader
 * (`resolveAuthoritativeLiveState` via occurrences + stream manifest).
 * - Live broadcast → "NOW LIVE" neon red pulse
 * - Not live → purple static badge + image placeholder (no preview video)
 */
export default function DashboardLiveStage({
  live,
}: {
  live: AttendeeDashboardData["live"];
}) {
  const isNowLive = live.isLive;

  return (
    <article className={`cl-live-stage${isNowLive ? " is-live" : ""}`}>
      <div className="cl-live-stage__header">
        <span
          className={`cl-pill ${isNowLive ? "cl-pill--now-live" : "cl-pill--offline"}`}
          aria-live="polite"
        >
          {isNowLive ? <i className="cl-pill__pulse" aria-hidden="true" /> : null}
          {isNowLive ? "Now Live" : "Offline"}
        </span>
        <span className="cl-live-stage__title">
          {isNowLive ? live.title ?? "COGIC LIVE broadcast" : "Service preview"}
        </span>
      </div>

      <div
        className="cl-live-stage__viewport"
        aria-label={
          isNowLive
            ? "COGIC LIVE is broadcasting — open Watch Live for the stream"
            : "COGIC LIVE is offline — placeholder preview"
        }
      >
        {isNowLive ? (
          <div className="cl-live-stage__empty">
            <div className="cl-live-stage__play">
              <Play aria-hidden="true" />
            </div>
            <strong>Live video opens in Watch Live</strong>
            <span>The production stream is available in the live experience.</span>
          </div>
        ) : (
          <Image
            src="/my-sanctuary/banner.png"
            alt=""
            fill
            sizes="(max-width: 720px) 100vw, 60vw"
            className="cl-live-stage__placeholder"
            priority={false}
          />
        )}
      </div>

      <Link
        href="/live"
        className={`cl-btn cl-btn--block ${isNowLive ? "cl-btn--live-action" : "cl-btn--primary"}`}
      >
        {isNowLive ? "Watch Live" : "Open Live Lobby"}
        <Radio aria-hidden="true" className="size-4" />
      </Link>
    </article>
  );
}
