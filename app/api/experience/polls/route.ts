import { NextResponse } from "next/server";
import { buildLivePollPayload } from "@/lib/experience/polls-server";
import { createServerSupabaseClient } from "@/lib/supabase/ssr-server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const admin = getSupabaseAdmin();
    const payload = await buildLivePollPayload(admin, user?.id ?? null);

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Live poll feed load failed:", error);
    return NextResponse.json(
      { error: "Unable to load audience poll." },
      { status: 500 },
    );
  }
}
