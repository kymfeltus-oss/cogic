import Link from "next/link";
import { Play, Radio } from "lucide-react";
import type { AttendeeDashboardData } from "@/lib/dashboard/load-attendee-dashboard";
import { resolveAttendeeMediaState } from "@/lib/live/attendee-media-state";
import {
  COGIC_SERVICE_PREVIEW_EMBED_URL,
  COGIC_SERVICE_PREVIEW_TITLE,
} from "@/lib/live/service-preview";

/** Live wins over a published, assigned replay; otherwise truthful OFFLINE. */
export default function DashboardLiveStage({
  live,
}: {
  live: AttendeeDashboardData["live"];
}) {
  const isNowLive = live.isLive;
  const mediaState = resolveAttendeeMediaState(isNowLive, live.featuredReplay);
  const replay = !isNowLive ? live.featuredReplay : null;
  const hasReplay = Boolean(replay?.playbackUrl);

  return (
    <article className="cl-live-stage">
      <div className="cl-live-stage__outside">
        <div className="cl-live-stage__outside-copy">
          <span className="cl-live-stage__outside-label">{mediaState.badge}</span>
        </div>
      </div>
      <div
        className="cl-live-stage__viewport"
        aria-label={
          isNowLive
            ? "COGIC LIVE is broadcasting — open Watch Live for the stream"
            : hasReplay && replay
              ? `${replay.title} is available to watch`
              : "COGIC LIVE is offline"
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
        ) : !hasReplay ? (
          <iframe
            src={COGIC_SERVICE_PREVIEW_EMBED_URL}
            title={COGIC_SERVICE_PREVIEW_TITLE}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <div className="cl-live-stage__empty">
            <div className="cl-live-stage__play">
              <Radio aria-hidden="true" />
            </div>
            <strong>OFFLINE</strong>
            <span>
              {live.nextTitle && live.nextTime
                ? `Next: ${live.nextTitle} · ${live.nextTime}`
                : "No live broadcast or selected replay is available right now."}
            </span>
          </div>
        )}
      </div>
      {mediaState.cta ? (
        <Link
          href={isNowLive ? "/live" : replay ? `/replays/${encodeURIComponent(replay.id)}` : "/live"}
          className="cl-btn cl-btn--block"
        >
          {isNowLive ? "WATCH LIVE" : mediaState.cta}
          <Play aria-hidden="true" className="size-4" />
        </Link>
      ) : (
        <Link href="/live" className="cl-btn cl-btn--block">
          OPEN LIVE HUB
          <Radio aria-hidden="true" className="size-4" />
        </Link>
      )}
    </article>
  );
}
