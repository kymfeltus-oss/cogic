import type { Metadata } from "next";
import LiveDataLoader from "@/components/experience/live/LiveDataLoader";

/** Dynamic — stream state + manifest resolved per request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live | COGIC LIVE",
  description: "Official COGIC LIVE broadcast experience powered by real stream state.",
};

/** Attendee live entry — real live_stream_state + HLS/IVS infrastructure. */
export default function LivePage() {
  return <LiveDataLoader />;
}
