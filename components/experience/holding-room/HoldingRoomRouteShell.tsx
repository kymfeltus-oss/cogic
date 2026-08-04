"use client";

import ExperienceHoldingRoomPageClient from "@/components/experience/holding-room/ExperienceHoldingRoomPageClient";
import type { EventCountdownConfig } from "@/lib/live/countdown-config";
import type { CountdownParts } from "@/lib/live/event-lobby";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";

type HoldingRoomRouteShellProps = {
  initialCountdownConfig: EventCountdownConfig;
  initialCountdown: CountdownParts;
  initialProfile: AttendeeProfileSnapshot;
};

export default function HoldingRoomRouteShell({
  initialCountdownConfig,
  initialCountdown,
  initialProfile,
}: HoldingRoomRouteShellProps) {
  return (
    <ExperienceHoldingRoomPageClient
      initialCountdownConfig={initialCountdownConfig}
      initialCountdown={initialCountdown}
      initialProfile={initialProfile}
    />
  );
}
