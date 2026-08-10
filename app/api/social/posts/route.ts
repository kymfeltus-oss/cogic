import { NextRequest, NextResponse } from "next/server";
import {
  assertConnectSlowMode,
  createConnectPost,
  loadConnectFeedPayload,
  loadConnectMuteUntil,
  loadConnectPostingEnabled,
} from "@/lib/social/connect-server";
import {
  CONNECT_MAX_BODY_LENGTH,
  CONNECT_MAX_MEDIA,
  type ConnectMediaInput,
} from "@/lib/social/connect-types";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createServerSupabaseClient } from "@/lib/supabase/ssr-server";

function parseMediaItems(raw: unknown): ConnectMediaInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, CONNECT_MAX_MEDIA + 1).map((item) => {
    const row = item as Record<string, unknown>;
    return {
      type: row.type === "video" ? "video" : "image",
      path: String(row.path ?? ""),
      url: String(row.url ?? ""),
      mimeType: String(row.mimeType ?? ""),
      size: Number(row.size),
    };
  });
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.id) {
      return NextResponse.json({ error: "Sign in to view COGIC Connect." }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const payload = await loadConnectFeedPayload(admin, user);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Connect feed load failed:", error);
    return NextResponse.json({ error: "Unable to load COGIC Connect." }, { status: 500 });
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
      return NextResponse.json({ error: "Sign in to post in COGIC Connect." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const text =
      typeof body?.body === "string"
        ? body.body.trim()
        : typeof body?.content === "string"
          ? body.content.trim()
          : "";

    if (!text || text.length > CONNECT_MAX_BODY_LENGTH) {
      return NextResponse.json(
        { error: `Post must be between 1 and ${CONNECT_MAX_BODY_LENGTH} characters.` },
        { status: 400 },
      );
    }

    const mediaItems = parseMediaItems(body?.mediaItems);
    if (mediaItems.length > CONNECT_MAX_MEDIA) {
      return NextResponse.json(
        { error: `Maximum of ${CONNECT_MAX_MEDIA} media attachments allowed.` },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdmin();
    const postingEnabled = await loadConnectPostingEnabled(admin);
    if (!postingEnabled) {
      return NextResponse.json(
        { error: "Community posting is temporarily paused." },
        { status: 403 },
      );
    }

    const mutedUntil = await loadConnectMuteUntil(admin, user.id);
    if (mutedUntil) {
      return NextResponse.json(
        { error: "Your posting permissions are currently paused." },
        { status: 403 },
      );
    }

    const slowMode = await assertConnectSlowMode(admin, user.id);
    if (slowMode.ok === false) {
      return NextResponse.json({ error: slowMode.error }, { status: 429 });
    }

    const post = await createConnectPost(admin, {
      authorId: user.id,
      body: text,
      mediaItems,
    });

    return NextResponse.json({ success: true, post }, { status: 201 });
  } catch (error) {
    console.error("Connect post create failed:", error);
    const message = error instanceof Error ? error.message : "Unable to create post.";
    const status =
      message.includes("between 1 and") ||
      message.includes("Maximum of") ||
      message.includes("Media")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
