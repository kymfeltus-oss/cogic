import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { AttendeeDashboardData } from "@/lib/dashboard/load-attendee-dashboard";
import type { ScheduleOccurrenceDTO } from "@/lib/my-convocation/types";
import DashboardSection from "@/components/dashboard/DashboardSection";

export default function NowNextSection({
  live,
  schedule,
}: {
  live: AttendeeDashboardData["live"];
  schedule: ScheduleOccurrenceDTO[];
}) {
  const liveItem = schedule.find((item) => item.isLiveNow) ?? null;
  const nextFromSchedule =
    schedule.find(
      (item) =>
        !item.isLiveNow && item.status !== "completed" && item.status !== "canceled",
    ) ?? null;

  const nowTitle = live.isLive
    ? live.title ?? liveItem?.title ?? "Broadcast in progress"
    : "Nothing is live";
  const nowMeta = live.isLive
    ? liveItem?.timeLabel ?? "COGIC LIVE"
    : "Watch when production goes live";

  const nextTitle = live.nextTitle ?? nextFromSchedule?.title ?? null;
  const nextMeta =
    live.nextTime ??
    nextFromSchedule?.timeLabel ??
    (nextTitle ? "Published program" : "No upcoming item listed");

  return (
    <DashboardSection
      eyebrow="At a glance"
      title="Now / Next"
      action={
        <Link href="/program" className="cl-text-link">
          Full program <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      }
    >
      <div className="cl-now-next">
        <article className={`cl-card cl-card--tier-3 cl-now-next__card${live.isLive ? " is-live" : ""}`}>
          <p className="cl-now-next__label">Now</p>
          <h3 className="cl-now-next__title">{nowTitle}</h3>
          <p className="cl-now-next__meta">{nowMeta}</p>
          <Link href="/live" className="cl-text-link">
            {live.isLive ? "Enter live" : "Live lobby"}
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </article>

        <article className="cl-card cl-card--tier-3 cl-now-next__card">
          <p className="cl-now-next__label">Next</p>
          <h3 className="cl-now-next__title">{nextTitle ?? "No next event listed"}</h3>
          <p className="cl-now-next__meta">{nextMeta}</p>
          <Link href="/program" className="cl-text-link">
            View program
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </article>
      </div>
    </DashboardSection>
  );
}
