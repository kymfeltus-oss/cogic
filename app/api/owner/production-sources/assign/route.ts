import { NextResponse } from "next/server";
import { requireOwnerUser } from "@/lib/owner/auth";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PUT(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const occurrenceId = typeof body?.occurrenceId === "string" ? body.occurrenceId : "";
  const primarySourceId = typeof body?.primarySourceId === "string" ? body.primarySourceId : "";
  const backupSourceId = typeof body?.backupSourceId === "string" && body.backupSourceId ? body.backupSourceId : null;
  if (!UUID.test(occurrenceId) || !UUID.test(primarySourceId) || (backupSourceId && !UUID.test(backupSourceId)) || primarySourceId === backupSourceId) {
    return NextResponse.json({ error: "Valid occurrence and distinct source selections are required." }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  const { data: validSources } = await admin.from("broadcast_sources").select("id,active").in("id", [primarySourceId, ...(backupSourceId ? [backupSourceId] : [])]);
  if ((validSources ?? []).length !== (backupSourceId ? 2 : 1) || (validSources ?? []).some((source) => !source.active)) {
    return NextResponse.json({ error: "Selected source is not approved and active." }, { status: 400 });
  }
  const { error } = await admin.from("event_broadcast_assignments").upsert({
    event_occurrence_id: occurrenceId, primary_source_id: primarySourceId,
    backup_source_id: backupSourceId, updated_by: auth.userId, created_by: auth.userId,
  }, { onConflict: "event_occurrence_id" });
  if (error) return NextResponse.json({ error: "Unable to persist source assignment." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
