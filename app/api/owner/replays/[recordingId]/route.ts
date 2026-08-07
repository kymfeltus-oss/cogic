import { NextResponse } from "next/server";
import { requireOwnerUser } from "@/lib/owner/auth";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set([
  "draft",
  "processing",
  "ready",
  "published",
  "unpublished",
  "archived",
  "failed",
]);

function validUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const { recordingId } = await params;
  if (!UUID.test(recordingId)) {
    return NextResponse.json({ error: "Invalid recording ID." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const status =
    typeof body?.publicationStatus === "string" ? body.publicationStatus : undefined;
  if (status && !STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid publication status." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("past_broadcast_recordings")
    .select("id, recording_url, media_source_type, upload_status")
    .eq("id", recordingId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Replay not found." }, { status: 404 });
  }

  const nextUrl =
    body?.recordingUrl === undefined
      ? existing.recording_url
      : body.recordingUrl === null
        ? null
        : validUrl(body.recordingUrl)
          ? body.recordingUrl
          : "__invalid__";

  if (nextUrl === "__invalid__") {
    return NextResponse.json({ error: "recordingUrl must be http(s)." }, { status: 400 });
  }

  if (status === "published" && !nextUrl) {
    return NextResponse.json(
      { error: "A playback source is required before publishing." },
      { status: 409 },
    );
  }

  if (
    status === "published" &&
    existing.media_source_type === "manual_upload" &&
    existing.upload_status !== "ready" &&
    existing.upload_status !== null
  ) {
    return NextResponse.json(
      { error: "Manual upload must reach ready status before publishing." },
      { status: 409 },
    );
  }

  const patch: Record<string, unknown> = { updated_by: auth.userId };
  if (typeof body?.streamTitle === "string" && body.streamTitle.trim()) {
    patch.stream_title = body.streamTitle.trim();
  }
  if (typeof body?.description === "string") {
    patch.description = body.description.trim() || null;
  }
  const contentTypes = new Set(["REPLAY", "PRE_PRODUCTION", "PROMO", "LEADERSHIP_MESSAGE", "INTERVIEW", "EVENT_PREVIEW", "DEVOTIONAL", "ANNOUNCEMENT_VIDEO", "HISTORICAL", "OTHER"]);
  if (typeof body?.contentType === "string") {
    if (!contentTypes.has(body.contentType)) return NextResponse.json({ error: "Invalid content type." }, { status: 400 });
    patch.content_type = body.contentType;
  }
  if (typeof body?.shortDescription === "string") patch.short_description = body.shortDescription.trim() || null;
  if (typeof body?.speakerName === "string") patch.speaker_name = body.speakerName.trim() || null;
  if (typeof body?.featured === "boolean") patch.featured = body.featured;
  if (Array.isArray(body?.publicationDestinations)) {
    const destinations = new Set(["HOME", "LIVE_HUB", "REPLAY_LIBRARY", "EVENT_DETAIL", "ANNOUNCEMENT"]);
    if (!body.publicationDestinations.every((value) => typeof value === "string" && destinations.has(value))) return NextResponse.json({ error: "Invalid publication destination." }, { status: 400 });
    patch.publication_destinations = body.publicationDestinations;
  }
  if (body?.recordingUrl !== undefined) patch.recording_url = nextUrl;
  if (body?.thumbnailUrl === null || typeof body?.thumbnailUrl === "string") {
    const thumbnailUrl = typeof body.thumbnailUrl === "string" ? body.thumbnailUrl : "";
    patch.thumbnail_url = /^https?:\/\//i.test(thumbnailUrl) ? thumbnailUrl : null;
  }
  if (Number.isFinite(body?.durationSeconds) && Number(body.durationSeconds) > 0) {
    patch.duration_seconds = Number(body.durationSeconds);
  }
  if (typeof body?.broadcastDate === "string" && body.broadcastDate.trim()) {
    const parsed = Date.parse(body.broadcastDate);
    if (Number.isFinite(parsed)) patch.broadcast_date = new Date(parsed).toISOString();
  }
  if (body?.archiveId === null) {
    patch.archive_id = null;
  } else if (typeof body?.archiveId === "string" && UUID.test(body.archiveId)) {
    const { data: archive } = await admin
      .from("convocation_archives")
      .select("id")
      .eq("id", body.archiveId)
      .maybeSingle();
    if (!archive) {
      return NextResponse.json({ error: "Archive not found." }, { status: 404 });
    }
    patch.archive_id = body.archiveId;
  }
  if (status) {
    patch.publication_status = status;
    patch.published_at = status === "published" ? new Date().toISOString() : null;
    patch.archived_at = status === "archived" ? new Date().toISOString() : null;
  }

  const { error } = await admin
    .from("past_broadcast_recordings")
    .update(patch)
    .eq("id", recordingId);
  if (error) {
    return NextResponse.json({ error: "Unable to update replay." }, { status: 500 });
  }

  if (typeof body?.occurrenceId === "string" && UUID.test(body.occurrenceId)) {
    const occurrenceId = body.occurrenceId;
    const { data: occurrence } = await admin
      .from("event_occurrences")
      .select("id")
      .eq("id", occurrenceId)
      .maybeSingle();
    if (!occurrence) {
      return NextResponse.json({ error: "Occurrence not found." }, { status: 404 });
    }

    // Clear prior links pointing at this recording, then attach the selected occurrence.
    await admin
      .from("event_occurrences")
      .update({ replay_recording_id: null, updated_by: auth.userId })
      .eq("replay_recording_id", recordingId);
    const { error: linkError } = await admin
      .from("event_occurrences")
      .update({ replay_recording_id: recordingId, updated_by: auth.userId })
      .eq("id", occurrenceId);
    if (linkError) {
      return NextResponse.json(
        { error: "Replay updated but occurrence linkage failed." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ updated: true });
}
