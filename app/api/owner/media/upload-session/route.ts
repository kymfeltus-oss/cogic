import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  isAllowedVideoMimeType,
  MEDIA_UPLOAD_BUCKET,
  MEDIA_UPLOAD_MAX_BYTES,
  mediaObjectPath,
} from "@/lib/media/upload";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { requireOwnerUser } from "@/lib/owner/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Creates a draft recording + short-lived signed upload URL.
 * Browser uploads directly to Supabase Storage (not through the Vercel body).
 */
export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const title = typeof body?.streamTitle === "string" ? body.streamTitle.trim() : "";
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType.trim() : "";
  const fileSize = Number(body?.fileSize);
  const occurrenceId =
    typeof body?.occurrenceId === "string" ? body.occurrenceId.trim() : "";
  const description =
    typeof body?.description === "string" ? body.description.trim() || null : null;
  const contentType = typeof body?.contentType === "string" ? body.contentType : "REPLAY";
  const contentTypes = new Set(["REPLAY", "PRE_PRODUCTION", "PROMO", "LEADERSHIP_MESSAGE", "INTERVIEW", "EVENT_PREVIEW", "DEVOTIONAL", "ANNOUNCEMENT_VIDEO", "HISTORICAL", "OTHER"]);

  if (!title) {
    return NextResponse.json({ error: "streamTitle is required." }, { status: 400 });
  }
  if (!isAllowedVideoMimeType(mimeType)) {
    return NextResponse.json(
      { error: "Only video/mp4, video/webm, and video/quicktime are accepted." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MEDIA_UPLOAD_MAX_BYTES) {
    return NextResponse.json(
      { error: `File must be between 1 byte and ${MEDIA_UPLOAD_MAX_BYTES} bytes.` },
      { status: 400 },
    );
  }
  if (occurrenceId && !UUID.test(occurrenceId)) {
    return NextResponse.json(
      { error: "occurrenceId must be a valid UUID when supplied." },
      { status: 400 },
    );
  }
  if (!contentTypes.has(contentType)) return NextResponse.json({ error: "Invalid content type." }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: occurrence } = occurrenceId ? await admin
    .from("event_occurrences")
    .select("id")
    .eq("id", occurrenceId)
    .maybeSingle() : { data: null };
  if (occurrenceId && !occurrence) {
    return NextResponse.json({ error: "Occurrence not found." }, { status: 404 });
  }

  const recordingId = randomUUID();
  const storagePath = mediaObjectPath(auth.userId, recordingId, mimeType);
  const restreamEventId = `manual-upload:${recordingId}`;

  const { error: insertError } = await admin.from("past_broadcast_recordings").insert({
    id: recordingId,
    stream_title: title,
    description,
    restream_event_id: restreamEventId,
    recording_url: null,
    publication_status: "draft",
    media_source_type: "manual_upload",
    storage_bucket: MEDIA_UPLOAD_BUCKET,
    storage_path: storagePath,
    upload_status: "uploading",
    content_type: contentType,
    original_filename: typeof body?.originalFilename === "string" ? body.originalFilename.slice(0, 255) : null,
    created_by: auth.userId,
    updated_by: auth.userId,
  });

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message || "Unable to create upload draft." },
      { status: 500 },
    );
  }

  const { error: linkError } = occurrenceId ? await admin
    .from("event_occurrences")
    .update({ replay_recording_id: recordingId, updated_by: auth.userId })
    .eq("id", occurrenceId) : { error: null };

  if (linkError) {
    await admin.from("past_broadcast_recordings").delete().eq("id", recordingId);
    return NextResponse.json(
      { error: "Unable to link occurrence for upload." },
      { status: 500 },
    );
  }

  const { data: signed, error: signError } = await admin.storage
    .from(MEDIA_UPLOAD_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signError || !signed) {
    await admin
      .from("past_broadcast_recordings")
      .update({ upload_status: "failed", publication_status: "failed" })
      .eq("id", recordingId);
    return NextResponse.json(
      { error: signError?.message || "Unable to create signed upload URL." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      recordingId,
      bucket: MEDIA_UPLOAD_BUCKET,
      path: storagePath,
      token: signed.token,
      signedUrl: signed.signedUrl,
      maxBytes: MEDIA_UPLOAD_MAX_BYTES,
      mimeType,
    },
    { status: 201, headers: { "Cache-Control": "private, no-store" } },
  );
}
