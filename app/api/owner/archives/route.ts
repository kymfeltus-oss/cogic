import { NextResponse } from "next/server";
import { listAllArchivesForOwner } from "@/lib/archives/repository";
import { slugifyArchivePart } from "@/lib/archives/types";
import { DEFAULT_PROGRAM_KEY } from "@/lib/events/types";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { requireOwnerUser } from "@/lib/owner/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  try {
    const archives = await listAllArchivesForOwner();
    return NextResponse.json(
      { archives },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Unable to load archives." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const year = Number(body?.year);
  const convocationNumber = Number(body?.convocationNumber);
  const description =
    typeof body?.description === "string" ? body.description.trim() || null : null;
  const published = body?.published === true;
  const sortOrder = Number.isFinite(body?.sortOrder) ? Number(body.sortOrder) : 0;
  const slugRaw =
    typeof body?.slug === "string" && body.slug.trim()
      ? body.slug.trim()
      : `${convocationNumber}-${year}`;
  const slug = slugifyArchivePart(slugRaw);

  if (!title || !slug || !Number.isInteger(year) || !Number.isInteger(convocationNumber)) {
    return NextResponse.json(
      { error: "title, year, and convocationNumber are required." },
      { status: 400 },
    );
  }

  const { data, error } = await getSupabaseAdmin()
    .from("convocation_archives")
    .insert({
      program_key: DEFAULT_PROGRAM_KEY,
      title,
      year,
      convocation_number: convocationNumber,
      slug,
      description,
      published,
      sort_order: sortOrder,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .select(
      "id, program_key, convocation_number, year, slug, title, description, published, sort_order",
    )
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message?.includes("unique") ? "Archive year or slug already exists." : "Unable to create archive." },
      { status: 409 },
    );
  }

  return NextResponse.json({ archive: data }, { status: 201 });
}
