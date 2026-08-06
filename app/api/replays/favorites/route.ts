import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/ssr-server";

async function getUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(request: NextRequest) {
  const recordingId = request.nextUrl.searchParams.get("recordingId")?.trim();
  if (!recordingId) return NextResponse.json({ error: "recordingId is required." }, { status: 400 });
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });
  const { data } = await supabase.from("replay_favorites").select("recording_id").eq("user_id", user.id).eq("recording_id", recordingId).maybeSingle();
  return NextResponse.json({ authenticated: true, saved: Boolean(data) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { recordingId?: string } | null;
  const recordingId = body?.recordingId?.trim();
  if (!recordingId) return NextResponse.json({ error: "recordingId is required." }, { status: 400 });
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to save replays." }, { status: 401 });
  const { error } = await supabase.from("replay_favorites").upsert({ user_id: user.id, recording_id: recordingId }, { onConflict: "user_id,recording_id" });
  if (error) return NextResponse.json({ error: "Unable to save replay." }, { status: 500 });
  return NextResponse.json({ saved: true });
}

export async function DELETE(request: NextRequest) {
  const recordingId = request.nextUrl.searchParams.get("recordingId")?.trim();
  if (!recordingId) return NextResponse.json({ error: "recordingId is required." }, { status: 400 });
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage saved replays." }, { status: 401 });
  const { error } = await supabase.from("replay_favorites").delete().eq("user_id", user.id).eq("recording_id", recordingId);
  if (error) return NextResponse.json({ error: "Unable to remove saved replay." }, { status: 500 });
  return NextResponse.json({ saved: false });
}
