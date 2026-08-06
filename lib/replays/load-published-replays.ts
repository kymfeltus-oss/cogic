import "server-only";

import { getPublishedOccurrences } from "@/lib/events/repository";
import { DEFAULT_PROGRAM_KEY } from "@/lib/events/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type PublishedReplay = {
  id: string;
  occurrenceId: string;
  title: string;
  description: string | null;
  localDate: string;
  playbackUrl: string;
  broadcastDate: string | null;
};

type RecordingRow = {
  id: string;
  stream_title: string;
  recording_url: string | null;
  broadcast_date: string | null;
  link_expires_at: string | null;
};

/**
 * Attendee replay catalog from published occurrences linked to real recordings.
 * Service-role read only; never invents demo replays.
 */
export async function loadPublishedReplays(
  programKey: string = DEFAULT_PROGRAM_KEY,
): Promise<PublishedReplay[]> {
  const occurrences = await getPublishedOccurrences({ programKey });
  const withReplay = occurrences.filter((row) => Boolean(row.replayRecordingId));
  if (withReplay.length === 0) return [];

  const recordingIds = [
    ...new Set(
      withReplay
        .map((row) => row.replayRecordingId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("past_broadcast_recordings")
    .select("id, stream_title, recording_url, broadcast_date, link_expires_at")
    .in("id", recordingIds);

  if (error) {
    throw new Error(`Unable to load replay recordings: ${error.message}`);
  }

  const now = Date.now();
  const byId = new Map<string, RecordingRow>();
  for (const row of (data ?? []) as RecordingRow[]) {
    if (!row.recording_url?.trim()) continue;
    if (row.link_expires_at) {
      const expires = Date.parse(row.link_expires_at);
      if (Number.isFinite(expires) && expires <= now) continue;
    }
    byId.set(row.id, row);
  }

  const replays: PublishedReplay[] = [];
  for (const occurrence of withReplay) {
    const recording = occurrence.replayRecordingId
      ? byId.get(occurrence.replayRecordingId)
      : undefined;
    if (!recording?.recording_url) continue;

    replays.push({
      id: recording.id,
      occurrenceId: occurrence.occurrenceId,
      title: occurrence.title || recording.stream_title,
      description: occurrence.description,
      localDate: occurrence.localDate,
      playbackUrl: recording.recording_url,
      broadcastDate: recording.broadcast_date,
    });
  }

  return replays.sort((a, b) => (a.localDate < b.localDate ? 1 : -1));
}
