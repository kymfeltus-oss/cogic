import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { TRAVEL_PROGRAM_KEY } from "@/lib/travel/types";
import { userHotelState } from "@/lib/travel/reservations";

const text = (v: unknown, n = 500) => String(v ?? "").trim().slice(0, n) || null;

const ATTENDEE_MANUAL_RETIRED = {
  error:
    "Typing a hotel confirmation number is retired. Official COGIC hotels are browse-and-request via COGIC Housing; marketplace hotels confirm only after paid in-app checkout.",
  code: "attendee_manual_retired",
  officialContactEmail: "housing@cogic.org",
  marketplacePath: "/travel",
} as const;

export async function GET() {
  const u = await getUserFromSession();
  if (!u?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  return NextResponse.json(await userHotelState(u.id), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

/**
 * Immutable retirement: attendee-typed confirmation numbers are never accepted.
 * Confirmed stays are written only by marketplace checkout fulfillment / supplier paths.
 */
export async function POST() {
  return NextResponse.json(ATTENDEE_MANUAL_RETIRED, {
    status: 410,
    headers: {
      "Cache-Control": "no-store",
      "X-Travel-Reservation-Create": "retired",
    },
  });
}

export async function PUT() {
  return NextResponse.json(ATTENDEE_MANUAL_RETIRED, {
    status: 410,
    headers: {
      "Cache-Control": "no-store",
      "X-Travel-Reservation-Create": "retired",
    },
  });
}

export async function PATCH(r: Request) {
  const u = await getUserFromSession();
  if (!u?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const b = await r.json().catch(() => null);
  const id = text(b?.id, 64);
  const action = String(b?.action ?? "");
  const db = getSupabaseAdmin();
  if (action === "cancel") {
    const { data, error } = await db
      .from("travel_hotel_reservations")
      .update({
        reservation_status: "canceled",
        primary_stay: false,
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", u.id)
      .select("hotel_id,room_type,check_in,check_out")
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
    }
    await db.from("travel_hotel_reservation_audit").insert({
      reservation_id: id,
      actor_user_id: u.id,
      action: "attendee_canceled",
      details: {},
    });
    await db.from("travel_analytics_events").insert({
      program_key: TRAVEL_PROGRAM_KEY,
      user_id: u.id,
      event_name: "hotel_reservation_canceled",
      properties: {
        hotel_id: data.hotel_id,
        room_type: data.room_type,
        arrival_date: data.check_in,
        departure_date: data.check_out,
      },
    });
    return NextResponse.json({ ok: true, status: "canceled" });
  }
  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
