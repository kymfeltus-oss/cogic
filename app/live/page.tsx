import type { Metadata } from "next";
import LiveHubClient from "@/components/live/hub/LiveHubClient";
import { loadLiveHub } from "@/lib/live/load-live-hub";
import "./live-hub.css";

/** Dynamic — stream state + hub rails resolved per request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live Hub | COGIC LIVE",
  description:
    "Official COGIC LIVE hub — watch the broadcast, sow a seed, and browse replays from real stream and catalog state.",
};

/** Attendee Live Hub — single Watch Live destination with full media experience. */
export default async function LivePage() {
  const data = await loadLiveHub();
  return <LiveHubClient data={data} />;
}
