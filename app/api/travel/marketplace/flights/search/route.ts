import { NextResponse } from "next/server";
import { searchMarketplaceFlights } from "@/lib/travel/marketplace/search";
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
    const result = await searchMarketplaceFlights({
      origin: String(body?.origin ?? ""),
      destination: String(body?.destination ?? "STL"),
      departDate: String(body?.departDate ?? ""),
      returnDate: body?.returnDate ? String(body.returnDate) : null,
      adults: body?.adults ? Number(body.adults) : 1,
      cabin: body?.cabin ? String(body.cabin) : "economy",
    });

    const user = await getUserFromSession();
    await getSupabaseAdmin().from("travel_analytics_events").insert({
      program_key: TRAVEL_PROGRAM_KEY,
      user_id: user?.id ?? null,
      event_name: "travel_marketplace_flight_search",
      properties: {
        origin: String(body?.origin ?? ""),
        destination: String(body?.destination ?? "STL"),
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
