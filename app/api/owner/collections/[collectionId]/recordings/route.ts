import { NextResponse } from "next/server";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { requireOwnerUser } from "@/lib/owner/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const { collectionId } = await params;
  if (!UUID.test(collectionId)) {
    return NextResponse.json({ error: "Invalid collection ID." }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("media_collection_recordings")
    .select("collection_id, recording_id, sort_order")
    .eq("collection_id", collectionId)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Unable to load assignments." }, { status: 500 });
  }

  return NextResponse.json(
    { assignments: data ?? [] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const { collectionId } = await params;
  if (!UUID.test(collectionId)) {
    return NextResponse.json({ error: "Invalid collection ID." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const recordingId =
    typeof body?.recordingId === "string" ? body.recordingId.trim() : "";
  const sortOrder = Number.isFinite(body?.sortOrder) ? Number(body.sortOrder) : 0;

  if (!UUID.test(recordingId)) {
    return NextResponse.json({ error: "recordingId is required." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const [{ data: collection }, { data: recording }] = await Promise.all([
    admin.from("media_collections").select("id").eq("id", collectionId).maybeSingle(),
    admin.from("past_broadcast_recordings").select("id").eq("id", recordingId).maybeSingle(),
  ]);

  if (!collection) {
    return NextResponse.json({ error: "Collection not found." }, { status: 404 });
  }
  if (!recording) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  const { error } = await admin.from("media_collection_recordings").upsert({
    collection_id: collectionId,
    recording_id: recordingId,
    sort_order: sortOrder,
    created_by: auth.userId,
  });

  if (error) {
    return NextResponse.json({ error: "Unable to assign recording." }, { status: 500 });
  }

  return NextResponse.json({ assigned: true }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> },
) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const { collectionId } = await params;
  if (!UUID.test(collectionId)) {
    return NextResponse.json({ error: "Invalid collection ID." }, { status: 400 });
  }

  const recordingId =
    new URL(request.url).searchParams.get("recordingId")?.trim() ?? "";
  if (!UUID.test(recordingId)) {
    return NextResponse.json({ error: "recordingId is required." }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin()
    .from("media_collection_recordings")
    .delete()
    .eq("collection_id", collectionId)
    .eq("recording_id", recordingId);

  if (error) {
    return NextResponse.json({ error: "Unable to remove assignment." }, { status: 500 });
  }

  return NextResponse.json({ removed: true });
}
