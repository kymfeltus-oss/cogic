"use client";

import ExperienceDashboardInterfaceLayer from "@/components/experience/dashboard/ExperienceDashboardInterfaceLayer";
import type { EventCountdownConfig } from "@/lib/live/countdown-config";
import type { CountdownParts } from "@/lib/live/event-lobby";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";

type ExperienceDashboardContentProps = {
  profile: AttendeeProfileSnapshot;
  initialCountdownConfig?: EventCountdownConfig;
  initialCountdown?: CountdownParts;
};

export default function ExperienceDashboardContent({
  profile,
  initialCountdownConfig,
  initialCountdown,
}: ExperienceDashboardContentProps) {
  return (
    <ExperienceDashboardInterfaceLayer
      profile={profile}
      initialCountdownConfig={initialCountdownConfig}
      initialCountdown={initialCountdown}
    />
  );
}
