import type { PublishedOccurrence } from "@/lib/events/types";
import type { ManifestStreamConfig } from "@/lib/live/fetch-manifest-stream-config";

export type AuthoritativeLiveStatus = "live" | "upcoming" | "offline" | "stream_unavailable";

/**
 * Single server-side truth for attendee live state. A URL alone never makes a
 * service live: a published live occurrence and operator/provider live state
 * must agree, and an active playback source must exist.
 */
export function resolveAuthoritativeLiveState(
  occurrence: PublishedOccurrence | null,
  stream: ManifestStreamConfig | null,
): AuthoritativeLiveStatus {
  const occurrenceIsLive = occurrence?.status === "live";
  const occurrenceIsUpcoming = Boolean(occurrence && ["scheduled", "starting_soon", "next"].includes(occurrence.status));
  const providerIsLive = stream?.is_live === true && stream.active_source !== "offline";
  const hasPlayback = Boolean(stream?.playback_url || stream?.primary_playback_url || stream?.backup_playback_url);

  if (occurrenceIsLive && providerIsLive && hasPlayback) return "live";
  if (occurrenceIsLive && !providerIsLive) return "stream_unavailable";
  if (occurrenceIsUpcoming) return "upcoming";
  return "offline";
}
