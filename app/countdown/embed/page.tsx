import type { Metadata } from "next";
import PublicCountdownExperience from "@/components/countdown/PublicCountdownExperience";
import { computeCountdown } from "@/lib/live/event-lobby";
import { loadActiveCountdownConfig } from "@/lib/live/fetch-countdown-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "300 Awakening Countdown Overlay",
  description: "OBS / stream browser-source overlay — synced to the live event schedule.",
  robots: { index: false, follow: false },
};

/** Minimal embed for OBS Browser Source, Instagram Live overlays, and social streams. */
export default async function PublicCountdownEmbedPage() {
  const initialConfig = await loadActiveCountdownConfig();
  const initialCountdown = computeCountdown(initialConfig.start_time);

  return (
    <PublicCountdownExperience
      initialConfig={initialConfig}
      initialCountdown={initialCountdown}
      mode="embed"
    />
  );
}
