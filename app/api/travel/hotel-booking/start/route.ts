import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { TRAVEL_PROGRAM_KEY } from "@/lib/travel/types";

const safeDate = (v: unknown) =>
  /^2026-(10|11)-\d{2}$/.test(String(v ?? "")) ? String(v) : null;

/**
 * Official COGIC hotels are browse-and-request only until a live housing CRS is connected.
 * This records interest as a DRAFT journey for My Trip / owner visibility — it does not
 * create a PaymentIntent, ledger charge, or supplier confirmation.
 */
export async function POST(request: Request) {
  const user = await getUserFromSession();
  const body = await request.json().catch(() => null);
  const hotelId = String(body?.hotelId ?? "");
  const roomTypeId = body?.roomTypeId ? String(body.roomTypeId) : null;
  const checkIn = safeDate(body?.checkIn);
  const checkOut = safeDate(body?.checkOut);
  const db = getSupabaseAdmin();
  const { data: hotel } = await db
    .from("travel_hotels")
    .select("id,slug")
    .eq("id", hotelId)
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .eq("published", true)
    .maybeSingle();

  if (!hotel) {
    return NextResponse.json({ error: "Official hotel not found." }, { status: 404 });
  }

  const hotelPathKey = hotel.slug || hotel.id;
  const returnPath = `/travel/hotels/${encodeURIComponent(hotelPathKey)}${
    checkIn && checkOut
      ? `?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}`
      : ""
  }`;

  if (!user?.id) {
    return NextResponse.json(
      {
        error: "Sign in required.",
        loginUrl: `/login?next=${encodeURIComponent(returnPath)}`,
      },
      { status: 401 },
    );
  }

  const { data, error } = await db
    .from("travel_hotel_booking_journeys")
    .insert({
      program_key: TRAVEL_PROGRAM_KEY,
      user_id: user.id,
      hotel_id: hotelId,
      room_type_id: roomTypeId,
      selected_check_in: checkIn,
      selected_check_out: checkOut,
      // Stored for My Trip deep-link context only — the API response does not auto-redirect.
      redirect_destination: "/travel/trip",
      status: "DRAFT",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Unable to save official housing interest." },
      { status: 400 },
    );
  }

  await db.from("travel_analytics_events").insert({
    program_key: TRAVEL_PROGRAM_KEY,
    user_id: user.id,
    event_name: "hotel_booking_started",
    properties: {
      hotel_id: hotelId,
      room_type_id: roomTypeId,
      arrival_date: checkIn,
      departure_date: checkOut,
      booking_source: "cogic_travel_interest",
      mode: "browse_and_request",
    },
  });

  // Stay on the hotel page — UI must not auto-navigate after interest save.
  return NextResponse.json(
    {
      journeyId: data.id,
      status: "DRAFT",
      mode: "browse_and_request",
      message:
        "Housing interest saved. Contact COGIC Housing to complete an official stay — this app does not charge or confirm negotiated housing.",
      contactEmail: "housing@cogic.org",
      tripPath: "/travel/trip",
    },
    { status: 201 },
  );
}
