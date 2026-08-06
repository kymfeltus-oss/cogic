import Link from "next/link";
import { Maximize, Pause, Play, Radio, Settings, Volume2 } from "lucide-react";
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
          {live.isLive ? live.title ?? "COGIC LIVE broadcast" : "Live video"}
        </span>
      </div>

      <div className="cl-live-stage__viewport" aria-label="Live video area">
        <div className="cl-live-stage__empty">
          <div className="cl-live-stage__play"><Play aria-hidden="true" /></div>
          <strong>{live.isLive ? "Live video opens in Watch Live" : "No service is live right now"}</strong>
          <span>{live.isLive ? "Use the player controls on the live experience." : "The next published service will appear here."}</span>
        </div>
        <div className="cl-live-stage__controls" aria-hidden="true">
          <Pause /><Volume2 /><span className="cl-live-stage__track"><i /></span><span>LIVE</span><Settings /><Maximize />
        </div>
      </div>

      <Link href="/live" className="cl-btn cl-btn--primary cl-btn--block">
        {live.isLive ? "Watch Live" : "Open Live Lobby"}
        <Radio aria-hidden="true" className="size-4" />
      </Link>
    </article>
  );
}
