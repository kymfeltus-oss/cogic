import LiveHubClient from "@/components/live/hub/LiveHubClient";
import { loadLiveHub } from "@/lib/live/load-live-hub";

/**
 * Server entry for the attendee Live Hub (legacy name retained for imports).
 */
export default async function LiveDataLoader() {
  const data = await loadLiveHub();
  return <LiveHubClient data={data} />;
}
