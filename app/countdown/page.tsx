import type { Metadata } from "next";
import PublicCountdownExperience from "@/components/countdown/PublicCountdownExperience";
import { computeCountdown } from "@/lib/live/event-lobby";
import { loadActiveCountdownConfig } from "@/lib/live/fetch-countdown-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "300 Awakening Countdown | Vital Organs Entertainment",
  description: "Count down to the live experience — synced schedule, live chat monitor, and event details.",
};

/** Public shareable countdown — rings, schedule copy, and live chat monitor. */
export default async function PublicCountdownPage() {
  const initialConfig = await loadActiveCountdownConfig();
  const initialCountdown = computeCountdown(initialConfig.start_time);

  return (
    <PublicCountdownExperience
      initialConfig={initialConfig}
      initialCountdown={initialCountdown}
      mode="full"
    />
  );
}
