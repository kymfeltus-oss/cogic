import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  filterPublishedOccurrenceCandidates,
  sortPublishedOccurrences,
  type OccurrenceJoinRow,
  type PublishedOccurrenceFilters,
} from "@/lib/events/published-query";
import { DEFAULT_PROGRAM_KEY, type PublishedOccurrence } from "@/lib/events/types";

export type GetPublishedOccurrencesInput = PublishedOccurrenceFilters;

/**
 * Server-only published occurrence reader.
 * Filters explicitly (service role bypasses RLS) and scopes by program_key.
 */
export async function getPublishedOccurrences(
  input: GetPublishedOccurrencesInput = {},
): Promise<PublishedOccurrence[]> {
  const programKey = input.programKey?.trim() || DEFAULT_PROGRAM_KEY;
  const admin = getSupabaseAdmin();

  let query = admin
    .from("event_occurrences")
    .select(
      `
      id,
      event_id,
      title_override,
      status,
      visibility,
      timezone,
      local_date,
      scheduled_start_at,
      estimated_start_at,
      scheduled_end_at,
      venue_label,
      follows_occurrence_id,
      start_mode,
      broadcast_state_id,
      replay_recording_id,
      events!inner (
        id,
        program_key,
        slug,
        title,
        event_type,
        description,
        status,
        sort_order
      )
    `,
    )
    .eq("visibility", "published")
    .neq("status", "canceled")
    .eq("events.program_key", programKey)
    .eq("events.status", "published");

  if (input.date) {
    query = query.eq("local_date", input.date);
  }

  if (input.type) {
    query = query.eq("events.event_type", input.type);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to load published occurrences: ${error.message}`);
  }

  return sortPublishedOccurrences(
    filterPublishedOccurrenceCandidates(
      (data ?? []) as unknown as OccurrenceJoinRow[],
      input,
    ),
  );
}

export { filterPublishedOccurrenceCandidates, sortPublishedOccurrences };
