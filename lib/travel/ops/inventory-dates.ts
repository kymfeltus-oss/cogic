import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { stayDates } from "@/lib/travel/hotel-availability";
import { TRAVEL_PROGRAM_KEY } from "@/lib/travel/types";

export async function upsertInventoryDateRange(input: {
  roomTypeId: string;
  fromDate: string;
  toDate: string;
  status: "AVAILABLE" | "UNAVAILABLE";
  nightlyRateCents?: number | null;
  actorUserId: string;
}) {
  const fromDate = String(input.fromDate || "").trim();
  const toDate = String(input.toDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    throw new Error("fromDate and toDate must be YYYY-MM-DD.");
  }
  // stayDates uses exclusive checkOut; treat toDate as inclusive by adding one day mentally via end exclusive.
  const exclusiveEnd = new Date(`${toDate}T12:00:00Z`);
  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
  const endExclusive = exclusiveEnd.toISOString().slice(0, 10);
  const dates = stayDates(fromDate, endExclusive);
  if (!dates.length) throw new Error("Date range produced no inventory nights.");
  if (dates.length > 60) throw new Error("Inventory date edits are limited to 60 nights per submission.");

  const db = getSupabaseAdmin();
  const { data: room, error: roomError } = await db
    .from("travel_hotel_room_types")
    .select("id,nightly_rate_cents,program_key")
    .eq("id", input.roomTypeId)
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .maybeSingle();
  if (roomError || !room) throw new Error("Room type not found in official inventory.");

  const rate =
    typeof input.nightlyRateCents === "number" && Number.isFinite(input.nightlyRateCents)
      ? Math.max(0, Math.round(input.nightlyRateCents))
      : room.nightly_rate_cents;
  const now = new Date().toISOString();
  const rows = dates.map((stay_date) => ({
    program_key: TRAVEL_PROGRAM_KEY,
    room_type_id: input.roomTypeId,
    stay_date,
    availability_status: input.status,
    nightly_rate_cents: rate,
    source_verified_at: now,
    updated_by: input.actorUserId,
    updated_at: now,
  }));

  const { error } = await db
    .from("travel_hotel_nightly_availability")
    .upsert(rows, { onConflict: "room_type_id,stay_date" });
  if (error) throw new Error(error.message);

  return { roomTypeId: input.roomTypeId, nights: dates.length, status: input.status, dates };
}
