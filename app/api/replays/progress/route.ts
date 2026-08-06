import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/ssr-server";

function invalid(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const recordingId = request.nextUrl.searchParams.get("recordingId")?.trim();
  if (!recordingId) return invalid("recordingId is required.");
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });
  const { data, error } = await supabase.from("replay_watch_progress").select("last_position_seconds, duration_seconds, completed, updated_at").eq("user_id", user.id).eq("recording_id", recordingId).maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load watch progress." }, { status: 500 });
  return NextResponse.json({ authenticated: true, progress: data ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { recordingId?: string; positionSeconds?: number; durationSeconds?: number; completed?: boolean } | null;
  const recordingId = body?.recordingId?.trim();
  if (!recordingId || !Number.isFinite(body?.positionSeconds) || (body.positionSeconds ?? 0) < 0) return invalid("Invalid watch progress.");
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to save watch progress." }, { status: 401 });
  const { error } = await supabase.from("replay_watch_progress").upsert({ user_id: user.id, recording_id: recordingId, last_position_seconds: body.positionSeconds, duration_seconds: Number.isFinite(body.durationSeconds) ? body.durationSeconds : null, completed: body.completed === true }, { onConflict: "user_id,recording_id" });
  if (error) return NextResponse.json({ error: "Unable to save watch progress." }, { status: 500 });
  return NextResponse.json({ saved: true });
}
