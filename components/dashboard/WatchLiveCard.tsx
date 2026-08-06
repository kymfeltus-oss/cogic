import Link from "next/link";
import { ArrowRight, Play, Radio } from "lucide-react";
import type { AttendeeDashboardData } from "@/lib/dashboard/load-attendee-dashboard";

/** Compact live shortcut for the action grid (hero owns the cinematic treatment). */
export default function WatchLiveCard({ live }: { live: AttendeeDashboardData["live"] }) {
  return (
    <article className={`cl-action-card${live.isLive ? " cl-action-card--live" : ""}`}>
      <div className="cl-action-card__icon">
        {live.isLive ? <Play aria-hidden="true" /> : <Radio aria-hidden="true" />}
      </div>
      <p className="cl-action-card__eyebrow">{live.isLive ? "Live Now" : "Watch Live"}</p>
      <h3 className="cl-action-card__title">
        {live.isLive ? live.title ?? "COGIC LIVE broadcast" : "Live lobby"}
      </h3>
      <p className="cl-action-card__body">
        {live.isLive
          ? "Join the official broadcast experience."
          : live.nextTitle
            ? `Next: ${live.nextTitle}${live.nextTime ? ` · ${live.nextTime}` : ""}`
            : "Published broadcasts appear here when production goes live."}
      </p>
      <Link
        href="/live"
        className={`cl-btn ${live.isLive ? "cl-btn--primary" : "cl-btn--ghost"} cl-btn--block`}
      >
        {live.isLive ? "Watch Live" : "Open Live"}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </article>
  );
}
