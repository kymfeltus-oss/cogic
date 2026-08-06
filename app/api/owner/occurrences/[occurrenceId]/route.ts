import { NextResponse } from "next/server";
import {
  assertOwnerOccurrenceStatusChange,
  occurrenceRowFromWriteInput,
  parseOwnerOccurrenceWriteInput,
} from "@/lib/events/owner-occurrence-input";
import {
  DEFAULT_PROGRAM_KEY,
  isOccurrenceStatus,
  isOccurrenceVisibility,
  type OccurrenceStatus,
} from "@/lib/events/types";
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

type RouteContext = { params: Promise<{ occurrenceId: string }> };

/** Edit / publish / unpublish / cancel a real occurrence. */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const { occurrenceId } = await context.params;
  if (!occurrenceId?.trim()) {
    return NextResponse.json({ error: "occurrenceId is required." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Request body is required." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: existing, error: loadError } = await admin
    .from("event_occurrences")
    .select(
      `
      id,
      event_id,
      status,
      visibility,
      local_date,
      timezone,
      start_mode,
      scheduled_start_at,
      scheduled_end_at,
      estimated_start_at,
      venue_label,
      follows_occurrence_id,
      title_override,
      events!inner ( id, status, program_key )
    `,
    )
    .eq("id", occurrenceId)
    .eq("events.program_key", DEFAULT_PROGRAM_KEY)
    .maybeSingle();

  if (loadError || !existing) {
    return NextResponse.json({ error: "Occurrence not found." }, { status: 404 });
  }

  const action =
    typeof body.action === "string" ? body.action.trim().toLowerCase() : "update";

  let patch: Record<string, unknown> = { updated_by: auth.userId };

  if (action === "publish") {
    patch.visibility = "published";
    const rawEvent = existing.events as
      | { id: string; status: string; program_key: string }
      | { id: string; status: string; program_key: string }[]
      | null;
    const parent = Array.isArray(rawEvent) ? rawEvent[0] : rawEvent;
    if (parent && parent.status !== "published") {
      const { error: publishParentError } = await admin
        .from("events")
        .update({ status: "published", updated_by: auth.userId })
        .eq("id", parent.id)
        .eq("program_key", DEFAULT_PROGRAM_KEY);
      if (publishParentError) {
        return NextResponse.json(
          { error: "Unable to publish parent catalog event." },
          { status: 500 },
        );
      }
    }
  } else if (action === "unpublish") {
    patch.visibility = "unpublished";
  } else if (action === "cancel") {
    try {
      assertOwnerOccurrenceStatusChange(
        existing.status as OccurrenceStatus,
        "canceled",
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to cancel." },
        { status: 400 },
      );
    }
    patch.status = "canceled";
  } else {
    // Full field update — merge with existing required fields for validation.
    const merged = {
      eventId: existing.event_id,
      titleOverride: body.titleOverride ?? existing.title_override,
      localDate: body.localDate ?? existing.local_date,
      timezone: body.timezone ?? existing.timezone,
      startMode: body.startMode ?? existing.start_mode,
      scheduledStartAt: body.scheduledStartAt ?? existing.scheduled_start_at,
      scheduledEndAt:
        body.scheduledEndAt === undefined
          ? existing.scheduled_end_at
          : body.scheduledEndAt,
      estimatedStartAt:
        body.estimatedStartAt === undefined
          ? existing.estimated_start_at
          : body.estimatedStartAt,
      venueLabel: body.venueLabel === undefined ? existing.venue_label : body.venueLabel,
      followsOccurrenceId:
        body.followsOccurrenceId === undefined
          ? existing.follows_occurrence_id
          : body.followsOccurrenceId,
      visibility: body.visibility ?? existing.visibility,
      status: body.status ?? existing.status,
    };

    let input;
    try {
      input = parseOwnerOccurrenceWriteInput(merged, { requireEventId: true });
      if (input.status !== existing.status) {
        assertOwnerOccurrenceStatusChange(
          existing.status as OccurrenceStatus,
          input.status,
        );
      }
      if (!isOccurrenceVisibility(input.visibility) || !isOccurrenceStatus(input.status)) {
        throw new Error("Invalid visibility or status.");
      }
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid occurrence payload." },
        { status: 400 },
      );
    }

    if (input.visibility === "published") {
      const rawEvent = existing.events as
        | { id: string; status: string; program_key: string }
        | { id: string; status: string; program_key: string }[]
        | null;
      const parent = Array.isArray(rawEvent) ? rawEvent[0] : rawEvent;
      if (parent && parent.status !== "published") {
        const { error: publishParentError } = await admin
          .from("events")
          .update({ status: "published", updated_by: auth.userId })
          .eq("id", parent.id)
          .eq("program_key", DEFAULT_PROGRAM_KEY);
        if (publishParentError) {
          return NextResponse.json(
            { error: "Unable to publish parent catalog event." },
            { status: 500 },
          );
        }
      }
    }

    patch = occurrenceRowFromWriteInput(input, auth.userId, "update");
  }

  const { data, error } = await admin
    .from("event_occurrences")
    .update(patch)
    .eq("id", occurrenceId)
    .select(OCCURRENCE_SELECT)
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        error: error?.message?.includes("validate_occurrence")
          ? error.message
          : "Unable to update occurrence.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { occurrence: mapOccurrenceRow(data as Record<string, unknown>) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
