import { NextRequest, NextResponse } from "next/server";
import { isLivePollChoice } from "@/lib/experience/polls";
import {
  assertPollAcceptsVote,
  buildLivePollPayload,
  computePollTotals,
} from "@/lib/experience/polls-server";
import { resolveAuthenticatedBuyer } from "@/lib/checkout/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type PollVoteBody = {
  pollId?: string;
  choice?: string;
};

export async function POST(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedBuyer(request);

    if (!auth) {
      return NextResponse.json({ error: "Sign in to vote." }, { status: 401 });
    }

    const { buyer, withSessionCookies } = auth;
    const body = (await request.json()) as PollVoteBody;
    const pollId = body.pollId?.trim();
    const choice = body.choice?.trim();

    if (!pollId || !isLivePollChoice(choice)) {
      return NextResponse.json({ error: "Invalid poll vote payload." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const validation = await assertPollAcceptsVote(admin, pollId, choice);

    if (validation.ok === false) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status },
      );
    }

    const { error: insertError } = await admin.from("live_poll_votes").insert({
      poll_id: pollId,
      user_id: buyer.userId,
      vote_choice: choice,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "You have already voted in this poll." },
          { status: 409 },
        );
      }

      console.error("Poll vote insert failed:", insertError.message);
      return NextResponse.json({ error: "Unable to record vote." }, { status: 500 });
    }

    const [totals, payload] = await Promise.all([
      computePollTotals(admin, pollId),
      buildLivePollPayload(admin, buyer.userId),
    ]);

    return withSessionCookies(
      NextResponse.json({
        success: true,
        choice,
        totals,
        poll: payload.poll,
        userVote: choice,
      }),
    );
  } catch (error) {
    console.error("Poll vote POST failed:", error);
    return NextResponse.json({ error: "Unable to record vote." }, { status: 500 });
  }
}
