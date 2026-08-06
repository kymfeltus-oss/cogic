import { NextResponse } from "next/server";
import { listAllCollectionsForArchive } from "@/lib/archives/repository";
import { slugifyArchivePart } from "@/lib/archives/types";
import { DEFAULT_PROGRAM_KEY } from "@/lib/events/types";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { requireOwnerUser } from "@/lib/owner/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const archiveId = new URL(request.url).searchParams.get("archiveId")?.trim() ?? "";
  if (!UUID.test(archiveId)) {
    return NextResponse.json({ error: "archiveId is required." }, { status: 400 });
  }

  try {
    const collections = await listAllCollectionsForArchive(archiveId);
    return NextResponse.json(
      { collections },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Unable to load collections." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const archiveId = typeof body?.archiveId === "string" ? body.archiveId.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const keyRaw = typeof body?.key === "string" ? body.key.trim() : title;
  const key = slugifyArchivePart(keyRaw).replace(/-/g, "_") || "collection";
  const slug = slugifyArchivePart(
    typeof body?.slug === "string" && body.slug.trim() ? body.slug : title,
  );
  const description =
    typeof body?.description === "string" ? body.description.trim() || null : null;
  const published = body?.published === true;
  const sortOrder = Number.isFinite(body?.sortOrder) ? Number(body.sortOrder) : 0;

  if (!UUID.test(archiveId) || !title || !slug) {
    return NextResponse.json(
      { error: "archiveId, title, and slug are required." },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const { data: archive } = await admin
    .from("convocation_archives")
    .select("id, program_key")
    .eq("id", archiveId)
    .maybeSingle();
  if (!archive) {
    return NextResponse.json({ error: "Archive not found." }, { status: 404 });
  }

  const { data, error } = await admin
    .from("media_collections")
    .insert({
      archive_id: archiveId,
      program_key: archive.program_key || DEFAULT_PROGRAM_KEY,
      key,
      slug,
      title,
      description,
      published,
      sort_order: sortOrder,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .select(
      "id, archive_id, program_key, key, slug, title, description, published, sort_order",
    )
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Unable to create collection." },
      { status: 409 },
    );
  }

  return NextResponse.json({ collection: data }, { status: 201 });
}
