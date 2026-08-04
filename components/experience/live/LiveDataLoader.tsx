import LiveExperienceClient from "@/components/experience/live/LiveExperienceClient";
import { buildAttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";

type LiveDataLoaderProps = Record<string, never>;

/** Renders the clean /live shell without blocking on server profile reads. */
export default function LiveDataLoader(_props: LiveDataLoaderProps = {}) {
  const initialProfile = buildAttendeeProfileSnapshot(null, null);

  return (
    <LiveExperienceClient initialProfile={initialProfile} />
  );
}
