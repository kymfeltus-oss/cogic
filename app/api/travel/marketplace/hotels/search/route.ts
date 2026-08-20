import { NextResponse } from "next/server";
import { searchMarketplaceHotels } from "@/lib/travel/marketplace/search";
import {
  marketplaceSearchErrorResponse,
  marketplaceSearchHttpStatus,
} from "@/lib/travel/marketplace/search-http";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getUserFromSession } from "@/lib/auth/session";
import { TRAVEL_PROGRAM_KEY } from "@/lib/travel/types";
import { assertHotelStayEligible, resolveTravelRegistrationEligibility } from "@/lib/travel/registration-eligibility";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const user = await getUserFromSession();
    if (!user?.id) return NextResponse.json({error:"Sign in required."},{status:401});
    assertHotelStayEligible(
      await resolveTravelRegistrationEligibility(user.id),
      String(body?.checkIn ?? ""),
      String(body?.checkOut ?? ""),
    );
    const result = await searchMarketplaceHotels({
      destination: String(body?.destination ?? ""),
      checkIn: String(body?.checkIn ?? ""),
      checkOut: String(body?.checkOut ?? ""),
      adults: body?.adults ? Number(body.adults) : 2,
      bounds: body?.bounds ?? {
        north: body?.north,
        south: body?.south,
        east: body?.east,
        west: body?.west,
        northEast: body?.northEast,
        southWest: body?.southWest,
      },
    });

    await getSupabaseAdmin().from("travel_analytics_events").insert({
      program_key: TRAVEL_PROGRAM_KEY,
      user_id: user.id,
      event_name: "travel_marketplace_hotel_search",
      properties: {
        destination: String(body?.destination ?? ""),
        available: result.available,
        code: result.code,
        provider: result.provider,
        result_count: result.offers.length,
        bounds_applied: Boolean(result.bounds),
      },
    });

    return NextResponse.json(result, { status: marketplaceSearchHttpStatus(result) });
  } catch (error) {
    return marketplaceSearchErrorResponse(error);
  }
}
