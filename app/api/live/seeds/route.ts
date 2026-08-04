import { NextRequest, NextResponse } from "next/server";
import { resolveAuthenticatedBuyer } from "@/lib/checkout/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await resolveAuthenticatedBuyer(request);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { buyer, withSessionCookies } = auth;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("seed_wallets")
      .select("balance, used_free_taps")
      .eq("user_id", buyer.userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to load seed wallet:", error.message);
      return NextResponse.json(
        { error: "Unable to load seed balance." },
        { status: 500 },
      );
    }

    return withSessionCookies(
      NextResponse.json({
        balance: data?.balance ?? 0,
        usedFreeTaps: data?.used_free_taps ?? 0,
      }),
    );
  } catch (error) {
    console.error("Seed wallet route error:", error);
    return NextResponse.json(
      { error: "Unable to load seed balance." },
      { status: 500 },
    );
  }
}
