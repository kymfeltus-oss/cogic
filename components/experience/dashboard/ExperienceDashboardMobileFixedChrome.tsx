"use client";

import MobileNativeHeader from "@/components/navigation/MobileNativeHeader";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";

type ExperienceDashboardMobileFixedChromeProps = {
  profile: AttendeeProfileSnapshot;
  onProfileChange: (profile: AttendeeProfileSnapshot) => void;
};

/** Top chrome — menu + profile orb grouped on the upper right. */
export default function ExperienceDashboardMobileFixedChrome({
  profile,
  onProfileChange,
}: ExperienceDashboardMobileFixedChromeProps) {
  return (
    <MobileNativeHeader
      profile={profile}
      onProfileChange={onProfileChange}
      leading="none"
      className="dashboard-mobile-fixed-chrome"
    />
  );
}
