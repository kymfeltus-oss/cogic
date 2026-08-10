import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/ssr-server";

const REPORT_REASONS = new Set(["spam", "harassment", "safety", "other"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Sign in to report a post." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const messageId = typeof body?.messageId === "string" ? body.messageId.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim().toLowerCase() : "";
  const detail = typeof body?.detail === "string" ? body.detail.trim().slice(0, 500) : "";

  if (!UUID.test(messageId) || !REPORT_REASONS.has(reason)) {
    return NextResponse.json({ error: "Choose a valid report reason." }, { status: 400 });
  }

  const { data: message, error: messageError } = await supabase
    .from("chat_messages")
    .select("id, user_id")
    .eq("id", messageId)
    .is("deleted_at", null)
    .maybeSingle();

  if (messageError || !message) {
    return NextResponse.json({ error: "That post is no longer available." }, { status: 404 });
  }
  if (message.user_id === user.id) {
    return NextResponse.json({ error: "You cannot report your own post." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("chat_message_reports").upsert(
    {
      message_id: messageId,
      reporter_id: user.id,
      reason,
      detail: detail || null,
      status: "open",
      reviewed_by: null,
      reviewed_at: null,
      updated_at: now,
    },
    { onConflict: "message_id,reporter_id" },
  );

  if (error) {
    console.error("COGIC Social report failed:", error.message);
    return NextResponse.json({ error: "Unable to submit the report." }, { status: 500 });
  }

  return NextResponse.json(
    { reported: true },
    { status: 201, headers: { "Cache-Control": "private, no-store" } },
  );
}
