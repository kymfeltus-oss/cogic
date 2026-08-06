import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3 } from "lucide-react";
import DashboardCard from "@/components/dashboard/DashboardCard";
import type { ScheduleOccurrenceDTO } from "@/lib/my-convocation/types";

export default function TodayScheduleCard({ schedule, scheduleAvailable }: { schedule: ScheduleOccurrenceDTO[]; scheduleAvailable: boolean }) {
  return (
    <DashboardCard title="Today's Schedule" className="schedule-card">
      <div className="schedule-card__list">
        {schedule.length ? schedule.map((item) => (
          <div className="schedule-card__item" key={item.occurrenceKey}>
            <span><Clock3 aria-hidden="true" /></span><div><strong>{item.title}</strong><small>{item.timeLabel}</small></div>
          </div>
        )) : (
          <div className="schedule-card__empty"><span><CalendarDays aria-hidden="true" /></span><strong>No events are scheduled today.</strong><p>{scheduleAvailable ? "View the full published Convocation program." : "The official schedule has not been published yet."}</p></div>
        )}
      </div>
      <Link href="/program" className="dashboard-text-link">View Full Schedule <ArrowRight aria-hidden="true" /></Link>
    </DashboardCard>
  );
}
