import { NextResponse } from "next/server";
import { MEDIA_UPLOAD_BUCKET, publicMediaUrl } from "@/lib/media/upload";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { requireOwnerUser } from "@/lib/owner/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Finalize a direct-to-storage upload and mark the recording ready for publish. */
export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const recordingId =
    typeof body?.recordingId === "string" ? body.recordingId.trim() : "";
  const failed = body?.failed === true;

  if (!UUID.test(recordingId)) {
    return NextResponse.json({ error: "Invalid recordingId." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("past_broadcast_recordings")
    .select(
      "id, media_source_type, storage_bucket, storage_path, upload_status, publication_status",
    )
    .eq("id", recordingId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }
  if (existing.media_source_type !== "manual_upload") {
    return NextResponse.json(
      { error: "Recording is not a manual upload asset." },
      { status: 409 },
    );
  }

  if (failed) {
    await admin
      .from("past_broadcast_recordings")
      .update({
        upload_status: "failed",
        publication_status: "failed",
        updated_by: auth.userId,
      })
      .eq("id", recordingId);
    return NextResponse.json({ ok: false, uploadStatus: "failed" });
  }

  const bucket = (existing.storage_bucket as string) || MEDIA_UPLOAD_BUCKET;
  const path = existing.storage_path as string | null;
  if (!path) {
    return NextResponse.json({ error: "Upload path missing." }, { status: 500 });
  }

  const { data: listed, error: listError } = await admin.storage.from(bucket).list(
    path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "",
    {
      search: path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path,
      limit: 1,
    },
  );

  if (listError || !listed || listed.length === 0) {
    await admin
      .from("past_broadcast_recordings")
      .update({
        upload_status: "failed",
        publication_status: "failed",
        updated_by: auth.userId,
      })
      .eq("id", recordingId);
    return NextResponse.json(
      { error: "Uploaded object not found in storage." },
      { status: 409 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 500 });
  }

  const playbackUrl = publicMediaUrl(supabaseUrl, path);

  const { error } = await admin
    .from("past_broadcast_recordings")
    .update({
      recording_url: playbackUrl,
      upload_status: "ready",
      publication_status: "ready",
      updated_by: auth.userId,
    })
    .eq("id", recordingId);

  if (error) {
    return NextResponse.json({ error: "Unable to finalize upload." }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      recordingId,
      uploadStatus: "ready",
      publicationStatus: "ready",
      recordingUrl: playbackUrl,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
