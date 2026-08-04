import { NextRequest, NextResponse } from "next/server";
import {
  assertLiveReactionRateLimit,
  pruneStaleLiveReactions,
} from "@/lib/experience/live-reactions-server";
import {
  isLiveReactionType,
  type LiveReactionRow,
  type LiveReactionType,
} from "@/lib/experience/live-reactions";
import { resolveAuthenticatedBuyer } from "@/lib/checkout/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type LiveReactionPostBody = {
  reactionType?: string;
};

export async function POST(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedBuyer(request);

    if (!auth) {
      return NextResponse.json(
        { error: "Sign in to send reactions." },
        { status: 401 },
      );
    }

    const { buyer, withSessionCookies } = auth;
    const body = (await request.json()) as LiveReactionPostBody;
    const reactionType = body.reactionType?.trim() as LiveReactionType | undefined;

    if (!reactionType || !isLiveReactionType(reactionType)) {
      return NextResponse.json({ error: "Invalid reaction." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const rateLimit = await assertLiveReactionRateLimit(admin, buyer.userId);

    if (rateLimit.ok === false) {
      return NextResponse.json({ error: rateLimit.error }, { status: 429 });
    }

    const { data, error } = await admin
      .from("live_stream_reactions")
      .insert({
        user_id: buyer.userId,
        reaction_type: reactionType,
      })
      .select("id, user_id, reaction_type, created_at")
      .single();

    if (error || !data) {
      console.error("Live reaction insert failed:", error?.message);
      return NextResponse.json(
        { error: "Unable to send reaction." },
        { status: 500 },
      );
    }

    void pruneStaleLiveReactions(admin);

    return withSessionCookies(
      NextResponse.json({ reaction: data as LiveReactionRow }),
    );
  } catch (error) {
    console.error("Live reaction POST failed:", error);
    return NextResponse.json({ error: "Unable to send reaction." }, { status: 500 });
  }
}
