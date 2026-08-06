import "server-only";

import { DEFAULT_PROGRAM_KEY } from "@/lib/events/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const GIVING_SOURCE_TYPES = [
  "cogic_giving",
  "live",
  "replay",
  "event",
  "collection",
  "experience",
] as const;

export type GivingSourceType = (typeof GIVING_SOURCE_TYPES)[number];

export type GivingAttributionInput = {
  sourceType?: unknown;
  mediaId?: unknown;
  eventId?: unknown;
  eventOccurrenceId?: unknown;
  collectionId?: unknown;
  programKey?: unknown;
};

export type ResolvedGivingAttribution = {
  sourceType: GivingSourceType;
  programKey: string;
  mediaId: string | null;
  eventId: string | null;
  eventOccurrenceId: string | null;
  collectionId: string | null;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return UUID.test(trimmed) ? trimmed : null;
}

function asSourceType(value: unknown): GivingSourceType {
  if (typeof value === "string" && (GIVING_SOURCE_TYPES as readonly string[]).includes(value)) {
    return value as GivingSourceType;
  }
  return "cogic_giving";
}

/**
 * Validate client-proposed attribution against real published/owned records.
 * Never trusts client IDs without DB verification + program_key scope.
 */
export async function resolveGivingAttribution(
  input: GivingAttributionInput,
): Promise<{ ok: true; value: ResolvedGivingAttribution } | { ok: false; error: string }> {
  const sourceType = asSourceType(input.sourceType);
  const programKey =
    typeof input.programKey === "string" && input.programKey.trim()
      ? input.programKey.trim().slice(0, 80)
      : DEFAULT_PROGRAM_KEY;

  const mediaId = asUuid(input.mediaId);
  let eventId = asUuid(input.eventId);
  const eventOccurrenceId = asUuid(input.eventOccurrenceId);
  const collectionId = asUuid(input.collectionId);

  const admin = getSupabaseAdmin();

  if (mediaId) {
    const { data: recording } = await admin
      .from("past_broadcast_recordings")
      .select("id, publication_status")
      .eq("id", mediaId)
      .maybeSingle();
    if (!recording || recording.publication_status !== "published") {
      return { ok: false, error: "That replay is not available for giving attribution." };
    }
  }

  if (eventOccurrenceId) {
    const { data: row } = await admin
      .from("event_occurrences")
      .select("id, event_id, visibility, events!inner(id, program_key, status)")
      .eq("id", eventOccurrenceId)
      .maybeSingle();
    const rawEvent = row?.events as
      | { id?: string; program_key?: string; status?: string }
      | { id?: string; program_key?: string; status?: string }[]
      | null
      | undefined;
    const event = Array.isArray(rawEvent) ? rawEvent[0] ?? null : rawEvent ?? null;
    if (
      !row ||
      row.visibility !== "published" ||
      !event ||
      event.program_key !== programKey ||
      event.status !== "published"
    ) {
      return { ok: false, error: "That event occurrence is not available for giving attribution." };
    }
    eventId = event.id ?? eventId;
  } else if (eventId) {
    const { data: event } = await admin
      .from("events")
      .select("id, program_key, status")
      .eq("id", eventId)
      .maybeSingle();
    if (!event || event.program_key !== programKey || event.status !== "published") {
      return { ok: false, error: "That event is not available for giving attribution." };
    }
  }

  if (collectionId) {
    const { data: collection } = await admin
      .from("media_collections")
      .select("id, published, program_key, archive_id, convocation_archives!inner(published)")
      .eq("id", collectionId)
      .maybeSingle();
    const rawArchive = collection?.convocation_archives as
      | { published?: boolean }
      | { published?: boolean }[]
      | null
      | undefined;
    const archive = Array.isArray(rawArchive) ? rawArchive[0] ?? null : rawArchive ?? null;
    if (
      !collection ||
      !collection.published ||
      collection.program_key !== programKey ||
      !archive?.published
    ) {
      return { ok: false, error: "That collection is not available for giving attribution." };
    }
  }

  // Drop unused IDs for source types that do not require them.
  if (sourceType === "live" || sourceType === "cogic_giving" || sourceType === "experience") {
    // Keep optional occurrence/media if verified above.
  }
  if (sourceType === "replay" && !mediaId) {
    return { ok: false, error: "Replay giving requires a published recording." };
  }
  if (sourceType === "collection" && !collectionId) {
    return { ok: false, error: "Collection giving requires a published collection." };
  }
  if (sourceType === "event" && !eventId && !eventOccurrenceId) {
    return { ok: false, error: "Event giving requires a published event." };
  }

  return {
    ok: true,
    value: {
      sourceType,
      programKey,
      mediaId,
      eventId,
      eventOccurrenceId,
      collectionId,
    },
  };
}

export function attributionToStripeMetadata(
  attribution: ResolvedGivingAttribution,
): Record<string, string> {
  const meta: Record<string, string> = {
    source_type: attribution.sourceType,
    program_key: attribution.programKey,
  };
  if (attribution.mediaId) meta.media_id = attribution.mediaId;
  if (attribution.eventId) meta.event_id = attribution.eventId;
  if (attribution.eventOccurrenceId) {
    meta.event_occurrence_id = attribution.eventOccurrenceId;
  }
  if (attribution.collectionId) meta.collection_id = attribution.collectionId;
  return meta;
}

export function attributionInsertFields(attribution: ResolvedGivingAttribution) {
  return {
    source_type: attribution.sourceType,
    program_key: attribution.programKey,
    media_id: attribution.mediaId,
    event_id: attribution.eventId,
    event_occurrence_id: attribution.eventOccurrenceId,
    collection_id: attribution.collectionId,
    attribution_json: attribution,
  };
}
