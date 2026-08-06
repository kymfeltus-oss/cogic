import { NextResponse } from "next/server";
import {
  occurrenceRowFromWriteInput,
  parseOwnerOccurrenceWriteInput,
} from "@/lib/events/owner-occurrence-input";
import { DEFAULT_PROGRAM_KEY } from "@/lib/events/types";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { requireOwnerUser } from "@/lib/owner/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const OCCURRENCE_SELECT = `
  id,
  event_id,
  title_override,
  local_date,
  timezone,
  start_mode,
  scheduled_start_at,
  scheduled_end_at,
  estimated_start_at,
  venue_label,
  follows_occurrence_id,
  visibility,
  status,
  replay_recording_id,
  broadcast_state_id,
  created_at,
  updated_at,
  events!inner (
    id,
    title,
    event_type,
    program_key,
    status
  )
`;

function mapOccurrenceRow(row: Record<string, unknown>) {
  const rawEvent = row.events as
    | {
        id: string;
        title: string;
        event_type: string;
        program_key: string;
        status: string;
      }
    | {
        id: string;
        title: string;
        event_type: string;
        program_key: string;
        status: string;
      }[]
    | null;
  const event = Array.isArray(rawEvent) ? rawEvent[0] ?? null : rawEvent;
  return {
    id: row.id as string,
    eventId: event?.id ?? (row.event_id as string),
    title: (row.title_override as string | null)?.trim() || event?.title || "Untitled",
    titleOverride: (row.title_override as string | null) ?? null,
    eventTitle: event?.title ?? null,
    eventType: event?.event_type ?? null,
    localDate: row.local_date as string,
    timezone: row.timezone as string,
    startMode: row.start_mode as string,
    scheduledStartAt: (row.scheduled_start_at as string | null) ?? null,
    scheduledEndAt: (row.scheduled_end_at as string | null) ?? null,
    estimatedStartAt: (row.estimated_start_at as string | null) ?? null,
    venueLabel: (row.venue_label as string | null) ?? null,
    followsOccurrenceId: (row.follows_occurrence_id as string | null) ?? null,
    visibility: row.visibility as string,
    status: row.status as string,
    replayRecordingId: (row.replay_recording_id as string | null) ?? null,
    broadcastStateId: (row.broadcast_state_id as string | null) ?? null,
    eventStatus: event?.status ?? null,
    createdAt: (row.created_at as string | null) ?? null,
    updatedAt: (row.updated_at as string | null) ?? null,
  };
}

/** Owner occurrence list — includes unpublished. */
export async function GET() {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const { data, error } = await getSupabaseAdmin()
    .from("event_occurrences")
    .select(OCCURRENCE_SELECT)
    .eq("events.program_key", DEFAULT_PROGRAM_KEY)
    .order("local_date", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: "Unable to load occurrences." }, { status: 500 });
  }

  return NextResponse.json(
    { occurrences: (data ?? []).map((row) => mapOccurrenceRow(row as Record<string, unknown>)) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

/** Create a real occurrence for an existing catalog event. */
export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  let input;
  try {
    input = parseOwnerOccurrenceWriteInput(body, { requireEventId: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid occurrence payload." },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const { data: event, error: eventError } = await admin
    .from("events")
    .select("id, status, program_key")
    .eq("id", input.eventId)
    .eq("program_key", DEFAULT_PROGRAM_KEY)
    .maybeSingle();

  if (eventError || !event) {
    return NextResponse.json({ error: "Catalog event not found for this program." }, { status: 404 });
  }

  // Publishing an occurrence requires a published parent event for attendee visibility.
  if (input.visibility === "published" && event.status !== "published") {
    const { error: publishError } = await admin
      .from("events")
      .update({ status: "published", updated_by: auth.userId })
      .eq("id", event.id)
      .eq("program_key", DEFAULT_PROGRAM_KEY);
    if (publishError) {
      return NextResponse.json(
        { error: "Unable to publish parent catalog event for this occurrence." },
        { status: 500 },
      );
    }
  }

  const { data, error } = await admin
    .from("event_occurrences")
    .insert(occurrenceRowFromWriteInput(input, auth.userId, "create"))
    .select(OCCURRENCE_SELECT)
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        error: error?.message?.includes("validate_occurrence")
          ? error.message
          : "Unable to create occurrence.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { occurrence: mapOccurrenceRow(data as Record<string, unknown>) },
    { status: 201, headers: { "Cache-Control": "private, no-store" } },
  );
}
