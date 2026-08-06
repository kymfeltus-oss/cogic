import Link from "next/link";
import { ArrowRight, CalendarClock, Play, Radio } from "lucide-react";
import DashboardCard from "@/components/dashboard/DashboardCard";
import type { AttendeeDashboardData } from "@/lib/dashboard/load-attendee-dashboard";

export default function WatchLiveCard({ live }: { live: AttendeeDashboardData["live"] }) {
  return (
    <DashboardCard title="Watch Live" className="watch-card">
      <div className={`watch-card__visual${live.isLive ? " is-live" : ""}`}>
        {live.isLive ? <span className="watch-card__badge"><i /> Live</span> : null}
        <span className="watch-card__play">{live.isLive ? <Play /> : <Radio />}</span>
      </div>
      <div className="watch-card__body">
        <strong>{live.isLive ? (live.title ?? "COGIC LIVE broadcast") : "No service is live right now."}</strong>
        {live.nextTitle ? <p><CalendarClock aria-hidden="true" />Next: {live.nextTitle}{live.nextTime ? ` · ${live.nextTime}` : ""}</p> : <p>Published broadcasts will appear here when production goes live.</p>}
      </div>
      <Link href={live.isLive ? "/live" : "/program"} className="dashboard-button">{live.isLive ? "Watch Live" : "View Schedule"}<ArrowRight aria-hidden="true" /></Link>
    </DashboardCard>
  );
}
