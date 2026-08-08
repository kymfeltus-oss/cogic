import Link from "next/link";
import { Play, Radio } from "lucide-react";
import type { AttendeeDashboardData } from "@/lib/dashboard/load-attendee-dashboard";
import {
  COGIC_SERVICE_PREVIEW_EMBED_URL,
  COGIC_SERVICE_PREVIEW_TITLE,
} from "@/lib/live/service-preview";

/**
 * Status badge is driven by authoritative live state from the dashboard loader
 * (`resolveAuthoritativeLiveState` via occurrences + stream manifest).
 * - Live broadcast → "NOW LIVE" neon red pulse
 * - Not live → purple Offline badge + YouTube service preview
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
            : "COGIC LIVE service preview video"
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
          <iframe
            src={COGIC_SERVICE_PREVIEW_EMBED_URL}
            title={COGIC_SERVICE_PREVIEW_TITLE}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
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
