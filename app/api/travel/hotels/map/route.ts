import { NextResponse } from "next/server";
import { parseMapBounds } from "@/lib/travel/map-bounds";
import { publishedHotelsInBounds } from "@/lib/travel/repository";
import { resolveHotelImage } from "@/lib/travel/hotel-images";
import { getUserFromSession } from "@/lib/auth/session";
import { assertHotelStayEligible, resolveTravelRegistrationEligibility } from "@/lib/travel/registration-eligibility";

export const dynamic = "force-dynamic";

type MapHotelPayload = {
  id: string;
  slug: string | null;
  name: string;
  address: string | null;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  negotiatedRateCents: number | null;
  referenceRateCents: number | null;
  rateCurrency: string;
  cogicDesignation: "GENERAL" | "BISHOPS";
  pricingTiers: Array<{ id: string; name: string; nightlyRateCents: number }>;
  ratingMarks: string[];
};

function toPayload(hotel: Awaited<ReturnType<typeof publishedHotelsInBounds>>[number]): MapHotelPayload {
  const pricingTiers = (hotel.travel_hotel_room_types ?? [])
    .slice()
    .sort((a, b) => a.nightly_rate_cents - b.nightly_rate_cents)
    .map((room) => ({
      id: room.id,
      name: room.name,
      nightlyRateCents: room.nightly_rate_cents,
    }));

  const ratingMarks: string[] = [];
  if (hotel.cogic_designation === "BISHOPS") ratingMarks.push("Bishops Hotel");
  else ratingMarks.push("Official COGIC Housing");
  if (hotel.minimum_nights) ratingMarks.push(`${hotel.minimum_nights}-night minimum`);

  return {
    id: hotel.id,
    slug: hotel.slug,
    name: hotel.name,
    address: hotel.address,
    city: hotel.city,
    state: hotel.state,
    latitude: hotel.latitude!,
    longitude: hotel.longitude!,
    imageUrl: resolveHotelImage(hotel),
    negotiatedRateCents: hotel.negotiated_rate_cents,
    referenceRateCents: hotel.reference_rate_cents,
    rateCurrency: hotel.rate_currency,
    cogicDesignation: hotel.cogic_designation,
    pricingTiers,
    ratingMarks,
  };
}

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
    const bounds = parseMapBounds(body);
    if (!bounds) {
      return NextResponse.json(
        { error: "Valid map bounds (north, south, east, west) are required." },
        { status: 400 },
      );
    }

    const hotels = await publishedHotelsInBounds({
      bounds,
      checkIn: body?.checkIn ? String(body.checkIn) : null,
      checkOut: body?.checkOut ? String(body.checkOut) : null,
    });

    return NextResponse.json({
      bounds,
      hotels: hotels.map(toPayload),
      count: hotels.length,
    });
  } catch (error) {
    console.error("travel hotels map bounds query failed", error);
    return NextResponse.json(
      { error: "Unable to refresh hotels for the current map viewport." },
      { status: 500 },
    );
  }
}
