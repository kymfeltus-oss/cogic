import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Persist read state for an authenticated attendee. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Invalid announcement id." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: announcement } = await admin
    .from("announcements")
    .select("id, status, published_at, expires_at")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!announcement) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }

  if (announcement.expires_at && announcement.expires_at <= now) {
    return NextResponse.json({ error: "Announcement has expired." }, { status: 410 });
  }

  const { error } = await admin.from("announcement_reads").upsert(
    {
      announcement_id: id,
      user_id: user.id,
      read_at: now,
    },
    { onConflict: "announcement_id,user_id" },
  );

  if (error) {
    return NextResponse.json({ error: "Unable to mark as read." }, { status: 500 });
  }

  return NextResponse.json(
    { read: true, readAt: now },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
