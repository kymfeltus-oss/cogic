"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ProfileEditorModal from "@/components/profile/ProfileEditorModal";
import DashboardTopBar from "@/components/dashboard/DashboardTopBar";
import DashboardMobileNav from "@/components/dashboard/DashboardMobileNav";
import DesktopDashboardHome from "@/components/dashboard/DesktopDashboardHome";
import MobileDashboardHome from "@/components/dashboard/MobileDashboardHome";
import type { AttendeeDashboardData } from "@/lib/dashboard/load-attendee-dashboard";
import { useDesktopDashboard } from "@/lib/dashboard/use-desktop-dashboard";

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
  const isDesktop = useDesktopDashboard();
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

  const signedIn = Boolean(profile.userId);

  return (
    <div className="cl-dash">
      <div className="cl-dash__stage">
        <DashboardTopBar
          profile={profile}
          profileReturnPath={dashboardPath}
          onProfile={() => setProfileOpen(true)}
        />

        {isDesktop ? (
          <DesktopDashboardHome data={data} hero={hero} signedIn={signedIn} />
        ) : (
          <MobileDashboardHome data={data} />
        )}
      </div>

      {!isDesktop ? (
        <DashboardMobileNav homeHref={dashboardPath} pathname={pathname} />
      ) : null}

      {signedIn ? (
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
