import type { Metadata } from "next";
import ExperienceAttendeeDashboard from "@/components/experience/dashboard/ExperienceAttendeeDashboard";
import { hydrateAuthMetadataFromAttendee } from "@/lib/auth/sync-attendee-profile";
import { getUserFromSession } from "@/lib/auth/session";
import { fetchAttendeeProfileRecord } from "@/lib/experience/fetch-attendee-profile";
import { buildAttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";
import { AWAKENING_PRELOAD_ASSETS } from "@/lib/experience/awakening-dashboard-assets";
import { computeCountdown } from "@/lib/live/event-lobby";
import { loadActiveCountdownConfig } from "@/lib/live/fetch-countdown-config";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Attendee Dashboard | 300 Awakening",
  description: "Tap Into The Awakening — your premium attendee experience hub.",
};

export default async function AttendeeDashboardPage() {
  let user = await getUserFromSession();
  let attendeeRecord = user ? await fetchAttendeeProfileRecord(user.id) : null;

  if (user) {
    user = await hydrateAuthMetadataFromAttendee(user);
    if (!attendeeRecord) {
      attendeeRecord = await fetchAttendeeProfileRecord(user.id);
    }
  }

  const profile = buildAttendeeProfileSnapshot(user, attendeeRecord);
  const initialCountdownConfig = await loadActiveCountdownConfig();
  const initialCountdown = computeCountdown(initialCountdownConfig.start_time);

  return (
    <>
      {AWAKENING_PRELOAD_ASSETS.map((asset) => (
        <link
          key={asset.href}
          rel="preload"
          as={asset.as}
          href={asset.href}
          fetchPriority="high"
        />
      ))}
      <main id="main-content" className="min-h-dvh w-full">
        <ExperienceAttendeeDashboard
          initialProfile={profile}
          initialCountdownConfig={initialCountdownConfig}
          initialCountdown={initialCountdown}
        />
      </main>
    </>
  );
}
