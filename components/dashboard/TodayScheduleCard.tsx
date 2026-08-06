import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3 } from "lucide-react";
import DashboardSection from "@/components/dashboard/DashboardSection";
import type { ScheduleOccurrenceDTO } from "@/lib/my-convocation/types";

export default function TodayScheduleCard({
  schedule,
  scheduleAvailable,
}: {
  schedule: ScheduleOccurrenceDTO[];
  scheduleAvailable: boolean;
}) {
  return (
    <DashboardSection
      eyebrow="Schedule"
      title="Today at Convocation"
      action={
        <Link href="/program" className="cl-text-link">
          View all <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      }
    >
      {schedule.length ? (
        <div className="cl-rail" role="list">
          {schedule.map((item) => (
            <article
              key={item.occurrenceKey}
              className={`cl-rail__card${item.isLiveNow ? " is-live" : ""}`}
              role="listitem"
            >
              <div className="cl-rail__time">
                <Clock3 aria-hidden="true" className="size-3.5" />
                <span>{item.timeLabel}</span>
              </div>
              <h3 className="cl-rail__title">{item.title}</h3>
              {item.venueLabel ? <p className="cl-rail__meta">{item.venueLabel}</p> : null}
              {item.isLiveNow ? <span className="cl-pill cl-pill--live cl-pill--sm">Live</span> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="cl-empty-panel">
          <CalendarDays aria-hidden="true" className="size-6" />
          <strong>No events are scheduled today.</strong>
          <p>
            {scheduleAvailable
              ? "View the full published Convocation program."
              : "The official schedule has not been published yet."}
          </p>
          <Link href="/program" className="cl-btn cl-btn--ghost">
            Open program
          </Link>
        </div>
      )}
    </DashboardSection>
  );
}
