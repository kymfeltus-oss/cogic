"use client";

import ExperienceDashboardContent from "@/components/experience/dashboard/ExperienceDashboardContent";
import ExperienceDashboardMobileFixedChrome from "@/components/experience/dashboard/ExperienceDashboardMobileFixedChrome";
import type { EventCountdownConfig } from "@/lib/live/countdown-config";
import type { CountdownParts } from "@/lib/live/event-lobby";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";

type ExperienceDashboardMobileViewProps = {
  profile: AttendeeProfileSnapshot;
  onProfileChange: (profile: AttendeeProfileSnapshot) => void;
  initialCountdownConfig?: EventCountdownConfig;
  initialCountdown?: CountdownParts;
};

export default function ExperienceDashboardMobileView({
  profile,
  onProfileChange,
  initialCountdownConfig,
  initialCountdown,
}: ExperienceDashboardMobileViewProps) {
  return (
    <div
      data-dashboard-shell="mobile"
      className="experience-dashboard-stage relative flex h-dvh max-h-dvh min-h-0 w-full flex-col items-stretch justify-start overflow-hidden overscroll-none bg-brand-black pt-safe pb-safe"
    >
      <ExperienceDashboardMobileFixedChrome
        profile={profile}
        onProfileChange={onProfileChange}
      />

      <div className="relative z-10 flex min-h-0 w-full flex-1 overflow-y-auto overscroll-contain">
        <ExperienceDashboardContent
          profile={profile}
          initialCountdownConfig={initialCountdownConfig}
          initialCountdown={initialCountdown}
        />
      </div>
    </div>
  );
}
