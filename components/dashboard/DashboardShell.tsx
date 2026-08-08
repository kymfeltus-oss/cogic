"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ProfileEditorModal from "@/components/profile/ProfileEditorModal";
import DashboardTopBar from "@/components/dashboard/DashboardTopBar";
import DashboardHero from "@/components/dashboard/DashboardHero";
import DashboardLiveStage from "@/components/dashboard/DashboardLiveStage";
import AnnouncementsCard from "@/components/dashboard/AnnouncementsCard";
import DashboardLinkCard from "@/components/dashboard/DashboardLinkCard";
import TodayScheduleCard from "@/components/dashboard/TodayScheduleCard";
import GivingCard from "@/components/dashboard/GivingCard";
import MyConvocationCard from "@/components/dashboard/MyConvocationCard";
import DashboardMobileNav from "@/components/dashboard/DashboardMobileNav";
import DashboardSection from "@/components/dashboard/DashboardSection";
import StayConnectedPrompt from "@/components/notifications/StayConnectedPrompt";
import type { AttendeeDashboardData } from "@/lib/dashboard/load-attendee-dashboard";
import type { ReactNode } from "react";
import { Headphones, PlaySquare, UsersRound } from "lucide-react";
import TravelProgressCard from "@/components/dashboard/TravelProgressCard";
import TicketStoreClient from "@/components/tickets/TicketStoreClient";
import HousingExperience from "@/components/housing/HousingExperience";

export default function DashboardShell({
  data,
  dashboardPath = "/my-convocation",
  hero,
}: {
  data: AttendeeDashboardData;
  dashboardPath?: string;
  hero?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() || dashboardPath;
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState(data.profile);
  const [profileOpen, setProfileOpen] = useState(() => {
    const view = searchParams.get("view");
    return view === "profile" || view === "settings";
  });

  useEffect(() => {
    const view = searchParams.get("view");
    if (view !== "profile" && view !== "settings") return;
    router.replace(dashboardPath, { scroll: false });
  }, [dashboardPath, router, searchParams]);

  return (
    <div className="cl-dash">
      <div className="cl-dash__stage">
        <DashboardTopBar
          profile={profile}
          profileReturnPath={dashboardPath}
          onProfile={() => setProfileOpen(true)}
        />

        <main id="main-content" className="cl-dash__main">
          <div className="cl-dash__canvas">
            {hero ?? (
              <DashboardHero />
            )}

            <div className="cl-primary-row">
              <DashboardLiveStage live={data.live} />
              <TodayScheduleCard schedule={data.schedule} scheduleAvailable={data.scheduleAvailable} />
            </div>

            <StayConnectedPrompt signedIn={Boolean(profile.userId)} />

            <DashboardSection eyebrow="Explore COGIC LIVE" title="Your experience">
              <div className="cl-action-grid cl-action-grid--features">
                <MyConvocationCard
                  registration={data.registration}
                  signedIn={Boolean(profile.userId)}
                />
                <GivingCard />
                <TravelProgressCard />
                <AnnouncementsCard />
                <DashboardLinkCard eyebrow="COGIC Tube" title="Watch again" body="On-demand sermons, replays, and more." href="/replays" action="Watch now" icon={PlaySquare} />
                <DashboardLinkCard eyebrow="Prayer Room" title="Find strength" body="Prayer resources for the Convocation journey." href="/prayer" action="Enter Prayer Room" icon={Headphones} tone="gold" />
                <DashboardLinkCard eyebrow="COGIC Connect" title="Connect with COGIC" body="Reach the team and find your next step." href="/contact-us" action="Open Connect" icon={UsersRound} />
              </div>
            </DashboardSection>
            {profile.userId ? (
              <DashboardSection eyebrow="Event admission" title="My Tickets">
                <div className="cl-card cl-card--tier-2 cl-card--compact">
                  <TicketStoreClient compact />
                </div>
              </DashboardSection>
            ) : null}
            {profile.userId ? (
              <DashboardSection eyebrow="Accommodation" title="My Housing">
                <div className="cl-card cl-card--tier-2 cl-card--compact">
                  <HousingExperience compact />
                </div>
              </DashboardSection>
            ) : null}

          </div>
        </main>
      </div>

      <DashboardMobileNav homeHref="/my-convocation" pathname={pathname} />

      {profile.userId ? (
        <ProfileEditorModal
          isOpen={profileOpen}
          profile={profile}
          onClose={() => setProfileOpen(false)}
          onSaved={(next) => {
            setProfile(next);
            setProfileOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
