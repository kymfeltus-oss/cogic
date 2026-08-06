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
  { params }: { params: Promise<{ archiveId: string }> },
) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const { archiveId } = await params;
  if (!UUID.test(archiveId)) {
    return NextResponse.json({ error: "Invalid archive ID." }, { status: 400 });
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
  if (Number.isInteger(body?.year)) patch.year = Number(body.year);
  if (Number.isInteger(body?.convocationNumber)) {
    patch.convocation_number = Number(body.convocationNumber);
  }
  if (typeof body?.published === "boolean") patch.published = body.published;
  if (Number.isFinite(body?.sortOrder)) patch.sort_order = Number(body.sortOrder);

  const { error } = await getSupabaseAdmin()
    .from("convocation_archives")
    .update(patch)
    .eq("id", archiveId);

  if (error) {
    return NextResponse.json({ error: "Unable to update archive." }, { status: 500 });
  }

  return NextResponse.json({ updated: true });
}
