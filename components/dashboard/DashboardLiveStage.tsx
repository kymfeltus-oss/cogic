import Link from "next/link";
import { Play, Radio } from "lucide-react";
import type { AttendeeDashboardData } from "@/lib/dashboard/load-attendee-dashboard";
import { resolveAttendeeMediaState } from "@/lib/live/attendee-media-state";

/** Live wins over a published, assigned replay; no playable media is offline. */
export default function DashboardLiveStage({
  live,
}: {
  live: AttendeeDashboardData["live"];
}) {
  const isNowLive = live.isLive;
  const mediaState = resolveAttendeeMediaState(isNowLive, live.featuredReplay);
  const replay = mediaState.kind === "replay" ? live.featuredReplay : null;
  const hasReplay = mediaState.kind === "replay";

  return (
    <article className={`cl-live-stage${isNowLive ? " is-live" : hasReplay ? " is-playing" : " is-offline"}`}>
      <div className="cl-live-stage__header">
        <span
          className={`cl-pill ${isNowLive ? "cl-pill--now-live" : hasReplay ? "cl-pill--playing" : "cl-pill--offline"}`}
          aria-live="polite"
        >
          {isNowLive ? <i className="cl-pill__pulse" aria-hidden="true" /> : null}
          {mediaState.badge}
        </span>
        <span className="cl-live-stage__title">
          {isNowLive ? live.title ?? "COGIC LIVE broadcast" : replay?.title ?? "Currently offline"}
        </span>
      </div>

      <div
        className="cl-live-stage__viewport"
        aria-label={
          isNowLive
            ? "COGIC LIVE is broadcasting — open Watch Live for the stream"
            : hasReplay
              ? `${replay?.title ?? "COGIC LIVE replay"} is available to watch`
              : "COGIC LIVE is currently offline"
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
          <div className="cl-live-stage__empty">
            <strong>Currently Offline</strong>
            <span>Programming will appear here as soon as it is available.</span>
          </div>
        )}
      </div>

      {isNowLive || (hasReplay && replay) ? (
        <Link
          href={isNowLive ? "/live" : `/replays/${encodeURIComponent(replay.id)}`}
          className={`cl-btn cl-btn--block ${isNowLive ? "cl-btn--live-action" : "cl-btn--primary"}`}
        >
          {mediaState.cta}
          {isNowLive ? <Radio aria-hidden="true" className="size-4" /> : <Play aria-hidden="true" className="size-4" />}
        </Link>
      ) : null}
    </article>
  );
}
