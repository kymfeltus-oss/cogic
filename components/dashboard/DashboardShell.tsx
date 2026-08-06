"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ProfileEditorModal from "@/components/profile/ProfileEditorModal";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardTopBar from "@/components/dashboard/DashboardTopBar";
import DashboardHero from "@/components/dashboard/DashboardHero";
import NowNextSection from "@/components/dashboard/NowNextSection";
import WatchLiveCard from "@/components/dashboard/WatchLiveCard";
import TodayScheduleCard from "@/components/dashboard/TodayScheduleCard";
import GivingCard from "@/components/dashboard/GivingCard";
import MyConvocationCard from "@/components/dashboard/MyConvocationCard";
import SanctuaryPreview from "@/components/dashboard/SanctuaryPreview";
import DashboardMobileNav from "@/components/dashboard/DashboardMobileNav";
import DashboardSection from "@/components/dashboard/DashboardSection";
import type { AttendeeDashboardData } from "@/lib/dashboard/load-attendee-dashboard";
import type { ReactNode } from "react";

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
      <DashboardSidebar homeHref="/my-convocation" pathname={pathname} />

      <div className="cl-dash__stage">
        <DashboardTopBar
          profile={profile}
          profileReturnPath={dashboardPath}
          onProfile={() => setProfileOpen(true)}
        />

        <main id="main-content" className="cl-dash__main">
          <div className="cl-dash__canvas">
            {hero ?? (
              <DashboardHero live={data.live} firstName={profile.firstName} />
            )}

            <NowNextSection live={data.live} schedule={data.schedule} />

            <TodayScheduleCard
              schedule={data.schedule}
              scheduleAvailable={data.scheduleAvailable}
            />

            <DashboardSection eyebrow="For you" title="Your experience">
              <div className="cl-action-grid">
                <WatchLiveCard live={data.live} />
                <SanctuaryPreview />
                <GivingCard />
                <MyConvocationCard
                  registration={data.registration}
                  signedIn={Boolean(profile.userId)}
                />
              </div>
            </DashboardSection>

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
