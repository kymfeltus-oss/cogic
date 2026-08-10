import { NextResponse } from "next/server";
import {
  isConnectReactionType,
  toggleConnectReaction,
} from "@/lib/social/connect-reactions";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createServerSupabaseClient } from "@/lib/supabase/ssr-server";

export async function POST(request: Request) {
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
    const postId = typeof body?.postId === "string" ? body.postId.trim() : "";
    const reactionType =
      typeof body?.reactionType === "string"
        ? body.reactionType.trim().toLowerCase()
        : typeof body?.reaction === "string"
          ? body.reaction.trim().toLowerCase()
          : "";

    if (!isConnectReactionType(reactionType)) {
      return NextResponse.json({ error: "Invalid reaction type." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const result = await toggleConnectReaction(admin, {
      userId: user.id,
      postId,
      reaction: reactionType,
    });

    return NextResponse.json(
      {
        success: true,
        reactionType,
        active: result.active,
        likeCount: result.likeCount,
        amenCount: result.amenCount,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Connect reaction failed:", error);
    const message = error instanceof Error ? error.message : "Unable to update reaction.";
    const status =
      message.includes("Valid postId") ||
      message.includes("no longer available") ||
      message.includes("Invalid")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
