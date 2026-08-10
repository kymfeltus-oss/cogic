import { NextResponse } from "next/server";
import { searchMarketplaceHotels } from "@/lib/travel/marketplace/search";
import {
  marketplaceSearchErrorResponse,
  marketplaceSearchHttpStatus,
} from "@/lib/travel/marketplace/search-http";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getUserFromSession } from "@/lib/auth/session";
import { TRAVEL_PROGRAM_KEY } from "@/lib/travel/types";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const result = await searchMarketplaceHotels({
      destination: String(body?.destination ?? ""),
      checkIn: String(body?.checkIn ?? ""),
      checkOut: String(body?.checkOut ?? ""),
      adults: body?.adults ? Number(body.adults) : 2,
    });

    const user = await getUserFromSession();
    await getSupabaseAdmin().from("travel_analytics_events").insert({
      program_key: TRAVEL_PROGRAM_KEY,
      user_id: user?.id ?? null,
      event_name: "travel_marketplace_hotel_search",
      properties: {
        destination: String(body?.destination ?? ""),
        available: result.available,
        code: result.code,
        provider: result.provider,
        result_count: result.offers.length,
      },
    });

    return NextResponse.json(result, { status: marketplaceSearchHttpStatus(result) });
  } catch (error) {
    return marketplaceSearchErrorResponse(error);
  }
}
