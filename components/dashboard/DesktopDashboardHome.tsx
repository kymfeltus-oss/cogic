import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import DashboardHero from "@/components/dashboard/DashboardHero";
import DashboardLiveStage from "@/components/dashboard/DashboardLiveStage";
import DashboardSection from "@/components/dashboard/DashboardSection";
import TodayScheduleCard from "@/components/dashboard/TodayScheduleCard";
import StayConnectedPrompt from "@/components/notifications/StayConnectedPrompt";
import TicketStoreClient from "@/components/tickets/TicketStoreClient";
import HousingExperience from "@/components/housing/HousingExperience";
import { DASHBOARD_UTILITIES } from "@/lib/dashboard/dashboard-utilities";
import type { AttendeeDashboardData } from "@/lib/dashboard/load-attendee-dashboard";

/** Approved desktop dashboard composition — mounted only on desktop viewports. */
export default function DesktopDashboardHome({
  data,
  hero,
  signedIn,
}: {
  data: AttendeeDashboardData;
  hero?: ReactNode;
  signedIn: boolean;
}) {
  return (
    <main id="main-content" className="cl-dash__main cl-desktop-home">
      <div className="cl-dash__canvas">
        {hero ?? <DashboardHero />}

        <DashboardLiveStage live={data.live} />

        <StayConnectedPrompt signedIn={signedIn} />

        <nav className="cl-desktop-utilities" aria-label="COGIC LIVE features">
          {DASHBOARD_UTILITIES.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.title} href={item.href} className="cl-desktop-utility">
                <Icon aria-hidden="true" />
                <strong>{item.title}</strong>
                <span>{item.copy}</span>
                <i aria-hidden="true"><ArrowRight /></i>
              </Link>
            );
          })}
        </nav>

        <div className="cl-desktop-secondary">
          <TodayScheduleCard schedule={data.schedule} scheduleAvailable={data.scheduleAvailable} />
        </div>

        {signedIn ? (
          <DashboardSection eyebrow="Event admission" title="My Tickets">
            <TicketStoreClient compact />
          </DashboardSection>
        ) : null}
        {signedIn ? (
          <DashboardSection eyebrow="Accommodation" title="My Housing">
            <HousingExperience compact />
          </DashboardSection>
        ) : null}
      </div>
    </main>
  );
}
