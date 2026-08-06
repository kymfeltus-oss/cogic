import { NextResponse } from "next/server";
import {
  DEFAULT_PROGRAM_KEY,
  isEventStatus,
  type EventStatus,
} from "@/lib/events/types";
import { assertEventStatusTransition } from "@/lib/events/status";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { requireOwnerUser } from "@/lib/owner/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Owner catalog of program events + occurrence counts (includes drafts). */
export async function GET() {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const admin = getSupabaseAdmin();
  const [{ data: events, error: eventsError }, { data: occRows, error: occError }] =
    await Promise.all([
      admin
        .from("events")
        .select("id, slug, title, event_type, status, description, sort_order, program_key")
        .eq("program_key", DEFAULT_PROGRAM_KEY)
        .order("sort_order", { ascending: true }),
      admin
        .from("event_occurrences")
        .select("id, event_id, visibility, status, events!inner(program_key)")
        .eq("events.program_key", DEFAULT_PROGRAM_KEY),
    ]);

  if (eventsError || occError) {
    return NextResponse.json({ error: "Unable to load events." }, { status: 500 });
  }

  const counts = new Map<string, { total: number; published: number }>();
  for (const row of occRows ?? []) {
    const eventId = row.event_id as string;
    const current = counts.get(eventId) ?? { total: 0, published: 0 };
    current.total += 1;
    if (row.visibility === "published" && row.status !== "canceled") {
      current.published += 1;
    }
    counts.set(eventId, current);
  }

  return NextResponse.json(
    {
      events: (events ?? []).map((event) => {
        const count = counts.get(event.id as string) ?? { total: 0, published: 0 };
        return {
          id: event.id as string,
          slug: event.slug as string,
          title: event.title as string,
          eventType: event.event_type as string,
          status: event.status as string,
          description: (event.description as string | null) ?? null,
          sortOrder: event.sort_order as number,
          programKey: event.program_key as string,
          occurrenceCount: count.total,
          publishedOccurrenceCount: count.published,
        };
      }),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

/** Publish / archive catalog events (required before occurrences are attendee-visible). */
export async function PATCH(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const eventId = typeof body?.eventId === "string" ? body.eventId.trim() : "";
  const statusRaw = typeof body?.status === "string" ? body.status.trim() : "";

  if (!eventId || !isEventStatus(statusRaw)) {
    return NextResponse.json(
      { error: "eventId and a valid status are required." },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const { data: existing, error: loadError } = await admin
    .from("events")
    .select("id, status, program_key")
    .eq("id", eventId)
    .eq("program_key", DEFAULT_PROGRAM_KEY)
    .maybeSingle();

  if (loadError || !existing) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  try {
    assertEventStatusTransition(existing.status as EventStatus, statusRaw);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid status transition." },
      { status: 400 },
    );
  }

  const { data, error } = await admin
    .from("events")
    .update({ status: statusRaw, updated_by: auth.userId })
    .eq("id", eventId)
    .eq("program_key", DEFAULT_PROGRAM_KEY)
    .select("id, slug, title, event_type, status, description, sort_order, program_key")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Unable to update event." }, { status: 500 });
  }

  return NextResponse.json(
    {
      event: {
        id: data.id,
        slug: data.slug,
        title: data.title,
        eventType: data.event_type,
        status: data.status,
        description: data.description,
        sortOrder: data.sort_order,
        programKey: data.program_key,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
