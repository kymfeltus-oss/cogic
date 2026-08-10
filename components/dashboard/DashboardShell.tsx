"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ProfileEditorModal from "@/components/profile/ProfileEditorModal";
import DashboardTopBar from "@/components/dashboard/DashboardTopBar";
import DashboardMobileNav from "@/components/dashboard/DashboardMobileNav";
import AttendeeDashboardHome from "@/components/dashboard/AttendeeDashboardHome";
import type { AttendeeDashboardData } from "@/lib/dashboard/load-attendee-dashboard";

/** Universal attendee shell — approved mobile composition at every viewport. */
export default function DashboardShell({
  data,
  dashboardPath = "/my-convocation",
}: {
  data: AttendeeDashboardData;
  dashboardPath?: string;
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

  const signedIn = Boolean(profile.userId);

  return (
    <div className="cl-dash">
      <div className="cl-dashboard-media" aria-hidden="true">
        <Image
          className="cl-dashboard-media__artwork"
          src="/my-sanctuary/header-backgroung.png"
          alt=""
          fill
          priority
          sizes="(max-width: 430px) 100vw, 430px"
        />
        <Image
          className="cl-dashboard-media__bishops"
          src="/my-sanctuary/bishops-hc-2026-final.png"
          alt=""
          width={1536}
          height={1024}
          priority
          quality={100}
          sizes="(max-width: 430px) 100vw, 430px"
        />
      </div>

      <div className="cl-dash__stage">
        <DashboardTopBar
          profile={profile}
          profileReturnPath={dashboardPath}
          onProfile={() => setProfileOpen(true)}
        />

        <AttendeeDashboardHome data={data} signedIn={signedIn} />
      </div>

      <DashboardMobileNav homeHref={dashboardPath} pathname={pathname} />

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
