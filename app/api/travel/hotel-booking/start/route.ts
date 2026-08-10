import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { TRAVEL_PROGRAM_KEY } from "@/lib/travel/types";

const safeDate = (v: unknown) =>
  /^2026-(10|11)-\d{2}$/.test(String(v ?? "")) ? String(v) : null;

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

  // Journey stays in Travel: attendee confirms with a real confirmation number on My Trip.
  const destination = "/travel/trip";
  const { data, error } = await db
    .from("travel_hotel_booking_journeys")
    .insert({
      program_key: TRAVEL_PROGRAM_KEY,
      user_id: user.id,
      hotel_id: hotelId,
      room_type_id: roomTypeId,
      selected_check_in: checkIn,
      selected_check_out: checkOut,
      redirect_destination: destination,
      reservation_status: "booking_started",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Unable to start hotel booking journey." },
      { status: 400 },
    );
  }

  await db.from("travel_analytics_events").insert([
    {
      program_key: TRAVEL_PROGRAM_KEY,
      user_id: user.id,
      event_name: "hotel_booking_started",
      properties: {
        hotel_id: hotelId,
        room_type_id: roomTypeId,
        arrival_date: checkIn,
        departure_date: checkOut,
        booking_source: "cogic_travel",
      },
    },
    {
      program_key: TRAVEL_PROGRAM_KEY,
      user_id: user.id,
      event_name: "travel_booking_redirected",
      properties: {
        hotel_id: hotelId,
        room_type_id: roomTypeId,
        arrival_date: checkIn,
        departure_date: checkOut,
        booking_source: "cogic_travel",
        redirect_to: destination,
      },
    },
  ]);

  return NextResponse.json(
    {
      journeyId: data.id,
      redirectTo: destination,
      status: "booking_started",
    },
    { status: 201 },
  );
}
