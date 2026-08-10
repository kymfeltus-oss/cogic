import { NextRequest, NextResponse } from "next/server";
import {
  isUuid,
  loadDmInbox,
  loadDmThread,
  markDmThreadRead,
  sendDirectMessage,
} from "@/lib/social/dms-server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createServerSupabaseClient } from "@/lib/supabase/ssr-server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const recipientId = request.nextUrl.searchParams.get("recipient_id")?.trim() || "";
    const admin = getSupabaseAdmin();

    if (recipientId) {
      if (!isUuid(recipientId)) {
        return NextResponse.json({ error: "Valid recipient_id is required." }, { status: 400 });
      }
      const messages = await loadDmThread(admin, user.id, recipientId);
      await markDmThreadRead(admin, user.id, recipientId).catch((error) => {
        console.warn("DM mark-read failed:", error instanceof Error ? error.message : error);
      });
      return NextResponse.json(
        { messages },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const conversations = await loadDmInbox(admin, user.id);
    return NextResponse.json(
      { conversations },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("DM GET failed:", error);
    const message = error instanceof Error ? error.message : "Unable to load messages.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const recipientId =
      typeof body?.recipientId === "string"
        ? body.recipientId.trim()
        : typeof body?.recipient_id === "string"
          ? body.recipient_id.trim()
          : "";
    const text = typeof body?.body === "string" ? body.body.trim() : "";
    const mediaUrls = Array.isArray(body?.mediaUrls)
      ? body.mediaUrls.map((url) => String(url))
      : typeof body?.mediaUrl === "string" && body.mediaUrl.trim()
        ? [body.mediaUrl.trim()]
        : [];

    const admin = getSupabaseAdmin();
    const message = await sendDirectMessage(admin, {
      senderId: user.id,
      recipientId,
      body: text,
      mediaUrls,
    });

    return NextResponse.json({ success: true, message }, { status: 201 });
  } catch (error) {
    console.error("DM POST failed:", error);
    const message = error instanceof Error ? error.message : "Unable to send message.";
    const status =
      message.includes("between 1 and") ||
      message.includes("valid recipient") ||
      message.includes("yourself") ||
      message.includes("Maximum of") ||
      message.includes("HTTPS")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
