import { NextRequest, NextResponse } from "next/server";
import { resolveAuthenticatedBuyer } from "@/lib/checkout/server";
import {
  LIVE_SOW_CHAT_MESSAGE,
  resolveSowSeedBilling,
} from "@/lib/experience/live-seed-monetization";
import { insertFellowshipChatMessage } from "@/lib/experience/fellowship-chat-server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Spend free taps / wallet seeds and post a stage sow message to Fellowship Chat.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedBuyer(request);

    if (!auth) {
      return NextResponse.json({ error: "Sign in to sow a seed." }, { status: 401 });
    }

    const { buyer, withSessionCookies } = auth;
    const admin = getSupabaseAdmin();

    const { data: walletRow, error: walletError } = await admin
      .from("seed_wallets")
      .select("balance, used_free_taps")
      .eq("user_id", buyer.userId)
      .maybeSingle();

    if (walletError) {
      console.error("Sow seed wallet load failed:", walletError.message);
      return NextResponse.json(
        { error: "Unable to load seed wallet." },
        { status: 500 },
      );
    }

    const usedFreeTaps = walletRow?.used_free_taps ?? 0;
    const billing = resolveSowSeedBilling(usedFreeTaps);

    const { data: billingResult, error: billingError } = await admin.rpc(
      "process_emote_transaction",
      {
        p_user_id: buyer.userId,
        p_free_taps_consumed: billing.freeTapsConsumed,
        p_seed_cost: billing.seedCost,
      },
    );

    if (billingError) {
      const message = billingError.message.toLowerCase();

      if (message.includes("insufficient seed balance")) {
        return NextResponse.json(
          { error: "Not enough seeds. Buy a pack to keep sowing." },
          { status: 402 },
        );
      }

      if (message.includes("free tap limit exceeded")) {
        return NextResponse.json(
          { error: "Free sow taps used up for this stream." },
          { status: 429 },
        );
      }

      console.error("Sow seed billing failed:", billingError.message);
      return NextResponse.json({ error: "Unable to sow a seed." }, { status: 500 });
    }

    const insertResult = await insertFellowshipChatMessage(admin, {
      user_id: buyer.userId,
      email: buyer.email,
      content: LIVE_SOW_CHAT_MESSAGE,
    });

    if (insertResult.error || !insertResult.data) {
      console.error("Sow seed chat insert failed:", insertResult.error);

      await admin.rpc("reverse_emote_transaction", {
        p_user_id: buyer.userId,
        p_free_taps_consumed: billing.freeTapsConsumed,
        p_seed_cost: billing.seedCost,
      });

      return NextResponse.json(
        { error: "Unable to announce your seed in chat." },
        { status: 500 },
      );
    }

    const { broadcastAttendeeChatMessage } = await import(
      "@/lib/experience/broadcast-attendee-chat-message"
    );
    void broadcastAttendeeChatMessage({
      id: insertResult.data.id,
      user_id: insertResult.data.user_id,
      email: insertResult.data.email,
      content: insertResult.data.content,
      created_at: insertResult.data.created_at,
    }).catch((broadcastError) => {
      console.error("Attendee chat broadcast failed:", broadcastError);
    });

    const payload = billingResult as {
      balance?: number;
      used_free_taps?: number;
    };

    return withSessionCookies(
      NextResponse.json({
        balance: payload.balance ?? 0,
        usedFreeTaps: payload.used_free_taps ?? usedFreeTaps + billing.freeTapsConsumed,
        message: insertResult.data,
        billing,
      }),
    );
  } catch (error) {
    console.error("Sow seed route error:", error);
    return NextResponse.json({ error: "Unable to sow a seed." }, { status: 500 });
  }
}
