import type { Metadata } from "next";
import PublicCountdownExperience from "@/components/countdown/PublicCountdownExperience";
import { computeCountdown } from "@/lib/live/event-lobby";
import { loadActiveCountdownConfig } from "@/lib/live/fetch-countdown-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "300 Awakening OBS Countdown",
  description: "Horizontal stream overlay countdown for OBS and Restream.",
  robots: { index: false, follow: false },
};

/** Compact horizontal strip — ideal for 1920×540 OBS browser sources. */
export default async function PublicCountdownObsPage() {
  const initialConfig = await loadActiveCountdownConfig();
  const initialCountdown = computeCountdown(initialConfig.start_time);

  return (
    <PublicCountdownExperience
      initialConfig={initialConfig}
      initialCountdown={initialCountdown}
      mode="obs"
    />
  );
}
