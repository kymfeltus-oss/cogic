import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  boundsCenterDistanceKm,
  parseCoordinate,
  pointInBounds,
  type MapBounds,
} from "./map-bounds";
import { hotelAvailabilityRank } from "./hotel-availability";
import { TRAVEL_PROGRAM_KEY, type TravelHotel } from "./types";

function normalizeHotel(row: TravelHotel): TravelHotel {
  return {
    ...row,
    latitude: parseCoordinate(row.latitude),
    longitude: parseCoordinate(row.longitude),
  };
}

export async function publishedHotels(): Promise<TravelHotel[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("travel_hotels")
    .select(
      "*,travel_hotel_room_types(id,name,nightly_rate_cents,currency,travel_hotel_nightly_availability(stay_date,availability_status,nightly_rate_cents))",
    )
    .eq("program_key",TRAVEL_PROGRAM_KEY)
    .eq("published",true)
    .eq("archived",false)
    .eq("travel_hotel_room_types.published",true)
    .order("display_order");
  if (error) {
    console.error("Unable to load published travel hotels", error.message);
    return [];
  }
  return ((data ?? []) as TravelHotel[]).map(normalizeHotel);
}

export async function publishedHotel(slug: string): Promise<TravelHotel | null> {
  const hotels = await publishedHotels();
  return hotels.find((h) => h.slug === slug || h.id === slug) ?? null;
}

/** Hotels with real coordinates inside the map viewport, re-ranked for the sidebar. */
export async function publishedHotelsInBounds(input: {
  bounds: MapBounds;
  checkIn?: string | null;
  checkOut?: string | null;
}): Promise<TravelHotel[]> {
  const hotels = await publishedHotels();
  const checkIn = input.checkIn?.trim() || "";
  const checkOut = input.checkOut?.trim() || "";
  const searched = Boolean(checkIn && checkOut);

  return hotels
    .filter((hotel) => {
      if (hotel.latitude == null || hotel.longitude == null) return false;
      return pointInBounds(
        { latitude: hotel.latitude, longitude: hotel.longitude },
        input.bounds,
      );
    })
    .map((hotel) => ({
      hotel,
      availabilityRank: searched
        ? hotelAvailabilityRank(
            hotel.travel_hotel_room_types ?? [],
            checkIn,
            checkOut,
            hotel.minimum_nights,
          )
        : 0,
      distanceKm: boundsCenterDistanceKm(
        { latitude: hotel.latitude!, longitude: hotel.longitude! },
        input.bounds,
      ),
    }))
    .sort((a, b) => {
      if (a.availabilityRank !== b.availabilityRank) {
        return a.availabilityRank - b.availabilityRank;
      }
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return (a.hotel.negotiated_rate_cents ?? Number.MAX_SAFE_INTEGER) -
        (b.hotel.negotiated_rate_cents ?? Number.MAX_SAFE_INTEGER);
    })
    .map((row) => row.hotel);
}

export async function publicTravelInfo() {
  const db = getSupabaseAdmin();
  const [airports, transport, announcements] = await Promise.all([
    db
      .from("travel_airports")
      .select("*")
      .eq("program_key", TRAVEL_PROGRAM_KEY)
      .eq("published", true)
      .order("display_order"),
    db
      .from("travel_transportation_options")
      .select("*")
      .eq("program_key", TRAVEL_PROGRAM_KEY)
      .eq("published", true)
      .order("display_order"),
    db
      .from("travel_announcements")
      .select("*")
      .eq("program_key", TRAVEL_PROGRAM_KEY)
      .eq("published", true)
      .order("published_at", { ascending: false }),
  ]);
  return {
    airports: airports.data ?? [],
    transport: transport.data ?? [],
    announcements: announcements.data ?? [],
  };
}
