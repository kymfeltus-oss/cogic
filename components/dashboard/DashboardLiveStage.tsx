import Link from "next/link";
import { Play, Radio } from "lucide-react";
import type { AttendeeDashboardData } from "@/lib/dashboard/load-attendee-dashboard";

export default function DashboardLiveStage({
  live,
}: {
  live: AttendeeDashboardData["live"];
}) {
  return (
    <article className={`cl-live-stage${live.isLive ? " is-live" : ""}`}>
      <div className="cl-live-stage__header">
        <span className={`cl-pill${live.isLive ? " cl-pill--live" : ""}`}>
          {live.isLive ? <i className="cl-pill__pulse" aria-hidden="true" /> : <Radio aria-hidden="true" />}
          {live.isLive ? "Live" : "Watch Live"}
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
            src="https://www.youtube.com/embed/4nO4nPV38Qk?si=4SAw2YAxbRVJFM4V&start=7&autoplay=1&mute=1&playsinline=1&controls=1"
            title="COGIC LIVE service preview"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        )}
      </div>

      <Link href="/live" className="cl-btn cl-btn--live-action cl-btn--block">
        {live.isLive ? "Watch Live" : "Open Live Lobby"}
        <Radio aria-hidden="true" className="size-4" />
      </Link>
    </article>
  );
}
