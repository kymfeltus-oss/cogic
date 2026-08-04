"use client";

import ViewerPovGoLiveShell from "@/components/experience/live/pov/ViewerPovGoLiveShell";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";

type ViewerPovGoLiveGatedClientProps = {
  initialProfile: AttendeeProfileSnapshot;
};

/** POV preview route — always renders the Ian Craig live shell. */
export default function ViewerPovGoLiveGatedClient({
  initialProfile,
}: ViewerPovGoLiveGatedClientProps) {
  return <ViewerPovGoLiveShell initialProfile={initialProfile} />;
}
