import { NextResponse } from "next/server";
import { requireOwnerUser } from "@/lib/owner/auth";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}

export async function GET() {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("past_broadcast_recordings")
    .select(
      "id, stream_title, description, restream_event_id, recording_url, thumbnail_url, duration_seconds, broadcast_date, archive_id, publication_status, published_at, archived_at, updated_at, updated_by, media_source_type, storage_bucket, storage_path, upload_status",
    )
    .order("updated_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: "Unable to load replay records." }, { status: 500 });
  }

  const ids = (data ?? []).map((row) => row.id as string);
  let links: Array<{ id: string; replay_recording_id: string | null }> = [];
  if (ids.length > 0) {
    const { data: occurrenceLinks } = await admin
      .from("event_occurrences")
      .select("id, replay_recording_id")
      .in("replay_recording_id", ids);
    links = (occurrenceLinks ?? []) as Array<{
      id: string;
      replay_recording_id: string | null;
    }>;
  }

  const occurrenceByRecording = new Map(
    links
      .filter((row) => row.replay_recording_id)
      .map((row) => [row.replay_recording_id as string, row.id]),
  );

  const recordings = (data ?? []).map((row) => ({
    ...row,
    occurrence_id: occurrenceByRecording.get(row.id as string) ?? null,
  }));

  return NextResponse.json(
    { recordings },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const title = typeof body?.streamTitle === "string" ? body.streamTitle.trim() : "";
  const restreamEventId = typeof body?.restreamEventId === "string" ? body.restreamEventId.trim() : "";
  const occurrenceId = typeof body?.occurrenceId === "string" ? body.occurrenceId.trim() : "";
  const recordingUrl = body?.recordingUrl === undefined ? null : body.recordingUrl;
  if (!title || !restreamEventId || !occurrenceId || !UUID.test(occurrenceId) || (recordingUrl !== null && !validUrl(recordingUrl))) {
    return NextResponse.json({ error: "streamTitle, restreamEventId, occurrenceId, and a valid recordingUrl are required." }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  const { data: occurrence } = await admin.from("event_occurrences").select("id, replay_recording_id").eq("id", occurrenceId).maybeSingle();
  if (!occurrence) return NextResponse.json({ error: "Occurrence not found." }, { status: 404 });
  const { data: recording, error } = await admin.from("past_broadcast_recordings").insert({ stream_title: title, restream_event_id: restreamEventId, recording_url: recordingUrl, description: typeof body.description === "string" ? body.description.trim() || null : null, thumbnail_url: validUrl(body.thumbnailUrl) ? body.thumbnailUrl : null, duration_seconds: Number.isFinite(body.durationSeconds) && Number(body.durationSeconds) > 0 ? Number(body.durationSeconds) : null, publication_status: "ready", media_source_type: "external_url", updated_by: auth.userId }).select("id").single();
  if (error || !recording) return NextResponse.json({ error: "Unable to create replay record." }, { status: 409 });
  const { error: linkError } = await admin.from("event_occurrences").update({ replay_recording_id: recording.id, updated_by: auth.userId }).eq("id", occurrenceId);
  if (linkError) return NextResponse.json({ error: "Replay created but occurrence linkage failed." }, { status: 500 });
  return NextResponse.json({ id: recording.id }, { status: 201 });
}
