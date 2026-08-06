import { NextResponse } from "next/server";
import { requireOwnerUser } from "@/lib/owner/auth";
import { isOwnerAuthed, ownerAuthFailureResponse } from "@/lib/owner/api-response";
import { serializeBroadcastSource } from "@/lib/owner/production-sources";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);
  const admin = getSupabaseAdmin();
  const [{ data: crews, error: crewError }, { data: sources, error: sourceError }, { data: assignments, error: assignmentError }] = await Promise.all([
    admin.from("production_crews").select("id,name,contact_name,contact_email,contact_phone,active").order("name"),
    admin.from("broadcast_sources").select("id,crew_id,name,provider,channel_name,ingest_protocol,ingest_config_ref,playback_configured,recording_configured,is_backup,priority,operational_status,active,production_crews(name)").order("priority"),
    admin.from("event_broadcast_assignments").select("event_occurrence_id,primary_source_id,backup_source_id"),
  ]);
  if (crewError || sourceError || assignmentError) return NextResponse.json({ error: "Production source configuration is unavailable." }, { status: 503 });
  return NextResponse.json({
    crews: (crews ?? []).map((row) => ({ id: row.id, name: row.name, contactName: row.contact_name, contactEmail: row.contact_email, contactPhone: row.contact_phone, active: row.active })),
    sources: (sources ?? []).map((row) => serializeBroadcastSource(row as Record<string, unknown>)),
    assignments: (assignments ?? []).map((row) => ({ occurrenceId: row.event_occurrence_id, primarySourceId: row.primary_source_id, backupSourceId: row.backup_source_id })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.crewId !== "string" || typeof body.name !== "string" || !["ivs", "restream", "external"].includes(String(body.provider)) || !["rtmps", "srt"].includes(String(body.ingestProtocol))) {
    return NextResponse.json({ error: "Valid crew, source name, provider, and protocol are required." }, { status: 400 });
  }
  const { data, error } = await getSupabaseAdmin().from("broadcast_sources").insert({
    crew_id: body.crewId, name: body.name.trim(), provider: body.provider,
    channel_name: typeof body.channelName === "string" ? body.channelName.trim() || null : null,
    ingest_protocol: body.ingestProtocol, playback_configured: body.playbackConfigured === true,
    recording_configured: body.recordingConfigured === true, is_backup: body.backup === true,
    ingest_config_ref: null,
    created_by: auth.userId, updated_by: auth.userId,
  }).select("id").single();
  if (error) return NextResponse.json({ error: "Unable to create broadcast source." }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}
