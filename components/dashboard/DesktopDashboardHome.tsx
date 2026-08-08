import type { ReactNode } from "react";
import { Headphones, PlaySquare, UsersRound } from "lucide-react";
import AnnouncementsCard from "@/components/dashboard/AnnouncementsCard";
import DashboardHero from "@/components/dashboard/DashboardHero";
import DashboardLinkCard from "@/components/dashboard/DashboardLinkCard";
import DashboardLiveStage from "@/components/dashboard/DashboardLiveStage";
import DashboardSection from "@/components/dashboard/DashboardSection";
import GivingCard from "@/components/dashboard/GivingCard";
import MyConvocationCard from "@/components/dashboard/MyConvocationCard";
import TodayScheduleCard from "@/components/dashboard/TodayScheduleCard";
import TravelProgressCard from "@/components/dashboard/TravelProgressCard";
import StayConnectedPrompt from "@/components/notifications/StayConnectedPrompt";
import TicketStoreClient from "@/components/tickets/TicketStoreClient";
import HousingExperience from "@/components/housing/HousingExperience";
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
    <main id="main-content" className="cl-dash__main">
      <div className="cl-dash__canvas">
        {hero ?? <DashboardHero />}

        <div className="cl-primary-row">
          <DashboardLiveStage live={data.live} />
          <TodayScheduleCard schedule={data.schedule} scheduleAvailable={data.scheduleAvailable} />
        </div>

        <StayConnectedPrompt signedIn={signedIn} />

        <DashboardSection eyebrow="Explore COGIC LIVE" title="Your experience">
          <div className="cl-action-grid cl-action-grid--features">
            <MyConvocationCard registration={data.registration} signedIn={signedIn} />
            <GivingCard />
            <TravelProgressCard />
            <AnnouncementsCard />
            <DashboardLinkCard
              eyebrow="COGIC Tube"
              title="Watch again"
              body="On-demand sermons, replays, and more."
              href="/replays"
              action="Watch now"
              icon={PlaySquare}
            />
            <DashboardLinkCard
              eyebrow="Prayer Room"
              title="Find strength"
              body="Prayer resources for the Convocation journey."
              href="/prayer"
              action="Enter Prayer Room"
              icon={Headphones}
              tone="gold"
            />
            <DashboardLinkCard
              eyebrow="COGIC Connect"
              title="Connect with COGIC"
              body="Reach the team and find your next step."
              href="/contact-us"
              action="Open Connect"
              icon={UsersRound}
            />
          </div>
        </DashboardSection>

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
