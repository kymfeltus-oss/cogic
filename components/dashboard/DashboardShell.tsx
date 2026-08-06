"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProfileEditorModal from "@/components/profile/ProfileEditorModal";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardTopBar from "@/components/dashboard/DashboardTopBar";
import ConvocationHero from "@/components/dashboard/ConvocationHero";
import WatchLiveCard from "@/components/dashboard/WatchLiveCard";
import TodayScheduleCard from "@/components/dashboard/TodayScheduleCard";
import GivingCard from "@/components/dashboard/GivingCard";
import MyConvocationCard from "@/components/dashboard/MyConvocationCard";
import DashboardMobileNav from "@/components/dashboard/DashboardMobileNav";
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
    <div className="cogic-dashboard">
      <DashboardSidebar homeHref={dashboardPath} />
      <main id="main-content" className="cogic-dashboard__main">
        <DashboardTopBar
          profile={profile}
          profileReturnPath={dashboardPath}
          onProfile={() => setProfileOpen(true)}
        />
        <div className="cogic-dashboard__content">
          {hero ?? <ConvocationHero />}
          <section className="cogic-dashboard__cards" aria-label="Convocation overview">
            <WatchLiveCard live={data.live} />
            <TodayScheduleCard schedule={data.schedule} scheduleAvailable={data.scheduleAvailable} />
            <GivingCard />
            <MyConvocationCard registration={data.registration} signedIn={Boolean(profile.userId)} />
          </section>
        </div>
      </main>
      <DashboardMobileNav homeHref={dashboardPath} />
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
