import { NextResponse } from "next/server";
import { isOwnerAuthed, ownerAuthFailureResponse, ownerJsonResponse } from "@/lib/owner/api-response";
import { requireOwnerUser } from "@/lib/owner/auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MUTE_MINUTES = new Set([60, 1_440, 10_080]);

function text(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET() {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const admin = getSupabaseAdmin();
  const [settingsResult, messagesResult, reportsResult, mutesResult] = await Promise.all([
    admin.from("social_settings").select("posting_enabled, updated_at").eq("id", "community").maybeSingle(),
    admin
      .from("chat_messages")
      .select("id, user_id, email, content, created_at, deleted_at, is_pinned, pinned_at")
      .order("created_at", { ascending: false })
      .limit(150),
    admin
      .from("chat_message_reports")
      .select("id, message_id, reporter_id, reason, detail, status, created_at, reviewed_at")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("chat_room_mutes")
      .select("user_id, muted_until, reason")
      .gt("muted_until", new Date().toISOString()),
  ]);

  const firstError = settingsResult.error || messagesResult.error || reportsResult.error || mutesResult.error;
  if (firstError) {
    console.error("Owner COGIC Social load failed:", firstError.message);
    return NextResponse.json({ error: "Unable to load COGIC Social moderation." }, { status: 500 });
  }

  const userIds = [
    ...new Set([
      ...(messagesResult.data ?? []).map((row) => row.user_id as string),
      ...(reportsResult.data ?? []).map((row) => row.reporter_id as string),
    ]),
  ].filter(Boolean);
  const { data: profiles } = userIds.length
    ? await admin.from("attendees").select("id, first_name, last_name, avatar_url").in("id", userIds)
    : { data: [] };
  const profileById = new Map(
    (profiles ?? []).map((row) => [
      row.id as string,
      {
        name: [row.first_name, row.last_name].filter(Boolean).join(" ") || "Attendee",
        avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
      },
    ]),
  );
  const muteByUser = new Map((mutesResult.data ?? []).map((row) => [row.user_id as string, row]));

  return ownerJsonResponse({
    settings: {
      postingEnabled: settingsResult.data?.posting_enabled !== false,
      updatedAt: settingsResult.data?.updated_at ?? null,
    },
    messages: (messagesResult.data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      author: profileById.get(row.user_id as string)?.name || "Attendee",
      avatarUrl: profileById.get(row.user_id as string)?.avatarUrl ?? null,
      content: row.content,
      createdAt: row.created_at,
      deletedAt: row.deleted_at,
      isPinned: row.is_pinned === true,
      pinnedAt: row.pinned_at,
      mute: muteByUser.get(row.user_id as string) ?? null,
    })),
    reports: reportsResult.data ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await requireOwnerUser();
  if (!isOwnerAuthed(auth)) return ownerAuthFailureResponse(auth);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = text(body?.action, 40).toLowerCase();
  const messageId = text(body?.messageId, 64);
  const userId = text(body?.userId, 64);
  const reportId = text(body?.reportId, 64);
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  if (action === "set_posting") {
    if (typeof body?.enabled !== "boolean") {
      return NextResponse.json({ error: "enabled must be a boolean." }, { status: 400 });
    }
    const { error } = await admin.from("social_settings").upsert({
      id: "community",
      posting_enabled: body.enabled,
      updated_by: auth.userId,
      updated_at: now,
    });
    if (error) return NextResponse.json({ error: "Unable to update posting availability." }, { status: 500 });
    return ownerJsonResponse({ ok: true });
  }

  if (["pin", "unpin", "remove", "restore"].includes(action)) {
    if (!UUID.test(messageId)) {
      return NextResponse.json({ error: "Valid messageId is required." }, { status: 400 });
    }

    if (action === "pin") {
      const { error: clearError } = await admin
        .from("chat_messages")
        .update({ is_pinned: false, pinned_at: null, pinned_by: null })
        .eq("is_pinned", true);
      if (clearError) return NextResponse.json({ error: "Unable to update the pinned post." }, { status: 500 });
      const { error } = await admin
        .from("chat_messages")
        .update({ is_pinned: true, pinned_at: now, pinned_by: auth.userId })
        .eq("id", messageId)
        .is("deleted_at", null);
      if (error) return NextResponse.json({ error: "Unable to pin that post." }, { status: 500 });
    } else if (action === "unpin") {
      const { error } = await admin
        .from("chat_messages")
        .update({ is_pinned: false, pinned_at: null, pinned_by: null })
        .eq("id", messageId);
      if (error) return NextResponse.json({ error: "Unable to unpin that post." }, { status: 500 });
    } else if (action === "remove") {
      const { error } = await admin
        .from("chat_messages")
        .update({ deleted_at: now, deleted_by: auth.userId, is_pinned: false, pinned_at: null, pinned_by: null })
        .eq("id", messageId);
      if (error) return NextResponse.json({ error: "Unable to remove that post." }, { status: 500 });
    } else {
      const { error } = await admin
        .from("chat_messages")
        .update({ deleted_at: null, deleted_by: null })
        .eq("id", messageId);
      if (error) return NextResponse.json({ error: "Unable to restore that post." }, { status: 500 });
    }
    return ownerJsonResponse({ ok: true });
  }

  if (action === "mute") {
    const minutes = Number(body?.minutes);
    if (!UUID.test(userId) || !MUTE_MINUTES.has(minutes)) {
      return NextResponse.json({ error: "Valid userId and mute duration are required." }, { status: 400 });
    }
    const mutedUntil = new Date(Date.now() + minutes * 60_000).toISOString();
    const { error } = await admin.from("chat_room_mutes").upsert({
      user_id: userId,
      muted_until: mutedUntil,
      muted_by: auth.userId,
      reason: text(body?.reason) || "COGIC Social moderation",
      updated_at: now,
    });
    if (error) return NextResponse.json({ error: "Unable to mute that attendee." }, { status: 500 });
    return ownerJsonResponse({ ok: true });
  }

  if (action === "unmute") {
    if (!UUID.test(userId)) return NextResponse.json({ error: "Valid userId is required." }, { status: 400 });
    const { error } = await admin.from("chat_room_mutes").delete().eq("user_id", userId);
    if (error) return NextResponse.json({ error: "Unable to unmute that attendee." }, { status: 500 });
    return ownerJsonResponse({ ok: true });
  }

  if (action === "resolve_report" || action === "dismiss_report") {
    if (!UUID.test(reportId)) return NextResponse.json({ error: "Valid reportId is required." }, { status: 400 });
    const { error } = await admin
      .from("chat_message_reports")
      .update({
        status: action === "resolve_report" ? "resolved" : "dismissed",
        reviewed_by: auth.userId,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", reportId);
    if (error) return NextResponse.json({ error: "Unable to update that report." }, { status: 500 });
    return ownerJsonResponse({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported moderation action." }, { status: 400 });
}
