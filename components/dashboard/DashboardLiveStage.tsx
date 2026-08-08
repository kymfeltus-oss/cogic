import Link from "next/link";
import { Play, Radio } from "lucide-react";
import type { AttendeeDashboardData } from "@/lib/dashboard/load-attendee-dashboard";
import { resolveAttendeeMediaState } from "@/lib/live/attendee-media-state";
import {
  COGIC_SERVICE_PREVIEW_EMBED_URL,
  COGIC_SERVICE_PREVIEW_TITLE,
  COGIC_SERVICE_PREVIEW_WATCH_URL,
} from "@/lib/live/service-preview";

/** Live wins over a published, assigned replay; no playable media is offline. */
export default function DashboardLiveStage({
  live,
}: {
  live: AttendeeDashboardData["live"];
}) {
  const isNowLive = live.isLive;
  const mediaState = resolveAttendeeMediaState(isNowLive, live.featuredReplay, true);
  const replay = !isNowLive ? live.featuredReplay : null;
  const hasReplay = Boolean(replay?.playbackUrl);
  const isPlaying = mediaState.kind === "replay";

  return (
    <article className={`cl-live-stage${isNowLive ? " is-live" : isPlaying ? " is-playing" : " is-offline"}`}>
      <div className="cl-live-stage__header">
        <span
          className={`cl-pill ${isNowLive ? "cl-pill--now-live" : isPlaying ? "cl-pill--playing" : "cl-pill--offline"}`}
          aria-live="polite"
        >
          {isNowLive ? <i className="cl-pill__pulse" aria-hidden="true" /> : null}
          {mediaState.badge}
        </span>
        <span className="cl-live-stage__title">
          {isNowLive ? live.title ?? "COGIC LIVE broadcast" : replay?.title ?? "Service preview"}
        </span>
      </div>

      <div
        className="cl-live-stage__viewport"
        aria-label={
          isNowLive
            ? "COGIC LIVE is broadcasting — open Watch Live for the stream"
            : `${replay?.title ?? COGIC_SERVICE_PREVIEW_TITLE} is available to watch`
        }
      >
        {isNowLive ? (
          <div className="cl-live-stage__empty">
            <div className="cl-live-stage__play">
              <Play aria-hidden="true" />
            </div>
            <strong>Live broadcast available</strong>
            <span>Watch the official production stream in the live experience.</span>
          </div>
        ) : hasReplay && replay ? (
          <video
            src={replay.playbackUrl}
            poster={replay.thumbnailUrl ?? undefined}
            title={replay.title}
            controls
            playsInline
            preload="metadata"
          />
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

      {mediaState.cta ? (
        <Link
          href={isNowLive ? "/live" : replay ? `/replays/${encodeURIComponent(replay.id)}` : COGIC_SERVICE_PREVIEW_WATCH_URL}
          className={`cl-btn cl-btn--block ${isNowLive ? "cl-btn--live-action" : "cl-btn--primary"}`}
        >
          {mediaState.cta}
          {isNowLive ? <Radio aria-hidden="true" className="size-4" /> : <Play aria-hidden="true" className="size-4" />}
        </Link>
      ) : null}
    </article>
  );
}
