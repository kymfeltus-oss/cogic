import { NextResponse } from "next/server";
import { slugifyArchivePart } from "@/lib/archives/types";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { requireOwnerUser } from "@/lib/owner/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
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
  const patch: Record<string, unknown> = { updated_by: auth.userId };

  if (typeof body?.title === "string" && body.title.trim()) patch.title = body.title.trim();
  if (typeof body?.description === "string") {
    patch.description = body.description.trim() || null;
  }
  if (typeof body?.slug === "string" && body.slug.trim()) {
    patch.slug = slugifyArchivePart(body.slug);
  }
  if (typeof body?.key === "string" && body.key.trim()) {
    patch.key = slugifyArchivePart(body.key).replace(/-/g, "_");
  }
  if (typeof body?.published === "boolean") patch.published = body.published;
  if (Number.isFinite(body?.sortOrder)) patch.sort_order = Number(body.sortOrder);

  const { error } = await getSupabaseAdmin()
    .from("media_collections")
    .update(patch)
    .eq("id", collectionId);

  if (error) {
    return NextResponse.json({ error: "Unable to update collection." }, { status: 500 });
  }

  return NextResponse.json({ updated: true });
}
