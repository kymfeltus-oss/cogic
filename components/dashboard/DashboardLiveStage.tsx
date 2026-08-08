import Link from "next/link";
import { Play, Radio } from "lucide-react";
import type { AttendeeDashboardData } from "@/lib/dashboard/load-attendee-dashboard";
import {
  COGIC_SERVICE_PREVIEW_EMBED_URL,
  COGIC_SERVICE_PREVIEW_TITLE,
} from "@/lib/live/service-preview";

export default function DashboardLiveStage({
  live,
}: {
  live: AttendeeDashboardData["live"];
}) {
  return (
    <article className={`cl-card cl-card--tier-1 cl-card--live cl-live-stage${live.isLive ? " is-live" : ""}`}>
      <div className="cl-live-stage__header">
        <span className={`cl-pill ${live.isLive ? "cl-pill--live" : "cl-pill--ready"}`}>
          {live.isLive ? <i className="cl-pill__pulse" aria-hidden="true" /> : null}
          {live.isLive ? "Live" : "Ready"}
        </span>
        <span className="cl-live-stage__title">
          {live.isLive ? live.title ?? "COGIC LIVE broadcast" : "Service preview"}
        </span>
      </div>

      <div className="cl-live-stage__viewport" aria-label="COGIC LIVE service preview video">
        {live.isLive ? (
          <div className="cl-live-stage__empty">
            <div className="cl-live-stage__play"><Play aria-hidden="true" /></div>
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

      <Link href="/live" className="cl-btn cl-btn--primary cl-btn--block">
        {live.isLive ? "Watch Live" : "Open Live Lobby"}
        <Radio aria-hidden="true" className="size-4" />
      </Link>
    </article>
  );
}
