import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { TRAVEL_PROGRAM_KEY } from "@/lib/travel/types";
import type { MarketplaceCarOffer, MarketplaceFlightOffer, MarketplaceHotelOffer } from "./types";
import {
  assertMarketplaceTransition,
  isStaleMarketplaceAttempt,
  MARKETPLACE_STALE_AFTER_MS,
  type MarketplaceAttemptStatus,
} from "./lifecycle";

export type MarketplaceKind = "hotel" | "flight" | "car";
export type { MarketplaceAttemptStatus };
export {
  assertMarketplaceTransition,
  isStaleMarketplaceAttempt,
  MARKETPLACE_STALE_AFTER_MS,
};

export type MarketplaceAttempt = {
  id: string;
  program_key: string;
  user_id: string;
  kind: MarketplaceKind;
  provider_key: string;
  offer_id: string;
  provider_offer_ref: string | null;
  offer_snapshot: Record<string, unknown>;
  quoted_amount_cents: number | null;
  currency: string;
  destination_label: string | null;
  origin_label: string | null;
  start_at: string | null;
  end_at: string | null;
  partner_booking_url: string | null;
  return_path: string;
  status: MarketplaceAttemptStatus;
  confirmation_number: string | null;
  itinerary_kind: MarketplaceKind | null;
  itinerary_record_id: string | null;
  hotel_reservation_id: string | null;
  failure_reason: string | null;
  started_at: string;
  redirected_at: string | null;
  returned_at: string | null;
  confirmed_at: string | null;
  canceled_at: string | null;
  updated_at: string;
};

const money = (cents: number | null) =>
  cents == null ? null : Math.max(0, Math.round(cents));

function appOrigin() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function marketplaceReturnUrl(attemptId: string) {
  return `${appOrigin()}/travel/marketplace/return?attempt=${encodeURIComponent(attemptId)}`;
}

export async function createMarketplaceBookingAttempt(input: {
  userId: string;
  kind: MarketplaceKind;
  provider: string;
  offer: MarketplaceHotelOffer | MarketplaceFlightOffer | MarketplaceCarOffer;
  checkIn?: string | null;
  checkOut?: string | null;
}) {
  const db = getSupabaseAdmin();
  const offer = input.offer;
  const snapshot = { ...offer } as Record<string, unknown>;

  let destination_label: string | null = null;
  let origin_label: string | null = null;
  let start_at: string | null = null;
  let end_at: string | null = null;
  let quoted_amount_cents: number | null = null;
  const partner_booking_url: string | null = offer.bookingUrl ?? null;

  if (input.kind === "hotel") {
    const hotel = offer as MarketplaceHotelOffer;
    destination_label = [hotel.name, hotel.city, hotel.state].filter(Boolean).join(" · ") || hotel.name;
    quoted_amount_cents = money(hotel.totalRateCents ?? hotel.nightlyRateCents);
    if (input.checkIn) {
      snapshot.checkIn = input.checkIn;
      start_at = `${input.checkIn}T15:00:00.000Z`;
    }
    if (input.checkOut) {
      snapshot.checkOut = input.checkOut;
      end_at = `${input.checkOut}T11:00:00.000Z`;
    }
  } else if (input.kind === "flight") {
    const flight = offer as MarketplaceFlightOffer;
    origin_label = flight.origin;
    destination_label = flight.destination;
    start_at = flight.departAt;
    end_at = flight.arriveAt;
    quoted_amount_cents = money(flight.totalFareCents);
  } else {
    const car = offer as MarketplaceCarOffer;
    origin_label = car.pickupLocation;
    destination_label = car.dropoffLocation;
    start_at = car.pickupAt;
    end_at = car.dropoffAt;
    quoted_amount_cents = money(car.totalRateCents);
  }

  const { data, error } = await db
    .from("travel_marketplace_booking_attempts")
    .insert({
      program_key: TRAVEL_PROGRAM_KEY,
      user_id: input.userId,
      kind: input.kind,
      provider_key: input.provider || offer.provider,
      offer_id: offer.id,
      provider_offer_ref: offer.id,
      offer_snapshot: snapshot,
      quoted_amount_cents,
      currency: offer.currency || "USD",
      destination_label,
      origin_label,
      start_at,
      end_at,
      partner_booking_url,
      return_path: "/travel/trip",
      status: "booking_started",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to start marketplace booking attempt.");
  }

  const attempt = data as MarketplaceAttempt;
  const returnUrl = marketplaceReturnUrl(attempt.id);

  await db.from("travel_analytics_events").insert({
    program_key: TRAVEL_PROGRAM_KEY,
    user_id: input.userId,
    event_name: "travel_booking_redirected",
    properties: {
      booking_source: "marketplace",
      kind: input.kind,
      provider: attempt.provider_key,
      attempt_id: attempt.id,
      offer_id: attempt.offer_id,
      has_partner_url: Boolean(partner_booking_url),
    },
  });

  return {
    attempt,
    returnUrl,
    redirectTo: partner_booking_url || returnUrl,
    openPartner: Boolean(partner_booking_url),
  };
}

export async function markMarketplaceAttemptRedirected(attemptId: string, userId: string) {
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("travel_marketplace_booking_attempts")
    .update({ redirected_at: now, updated_at: now })
    .eq("id", attemptId)
    .eq("user_id", userId)
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .in("status", ["booking_started", "pending_confirmation"])
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as MarketplaceAttempt | null;
}

export async function markMarketplaceAttemptReturned(attemptId: string, userId: string) {
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: existing } = await db
    .from("travel_marketplace_booking_attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("user_id", userId)
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .maybeSingle();
  if (!existing) return null;
  if (existing.status === "confirmed" || existing.status === "canceled" || existing.status === "failed") {
    return existing as MarketplaceAttempt;
  }

  assertMarketplaceTransition(existing.status as MarketplaceAttemptStatus, "pending_confirmation");

  const { data, error } = await db
    .from("travel_marketplace_booking_attempts")
    .update({
      status: "pending_confirmation",
      returned_at: now,
      updated_at: now,
    })
    .eq("id", attemptId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as MarketplaceAttempt;
}

export async function listUserMarketplaceAttempts(userId: string, statuses?: MarketplaceAttemptStatus[]) {
  const db = getSupabaseAdmin();
  let query = db
    .from("travel_marketplace_booking_attempts")
    .select("*")
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .eq("user_id", userId)
    .order("started_at", { ascending: false });
  if (statuses?.length) query = query.in("status", statuses);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as MarketplaceAttempt[];
}

export async function getMarketplaceAttemptForUser(attemptId: string, userId: string) {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("travel_marketplace_booking_attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("user_id", userId)
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MarketplaceAttempt | null) ?? null;
}

async function ensureTrip(userId: string) {
  const db = getSupabaseAdmin();
  let { data } = await db
    .from("user_trips")
    .select("*")
    .eq("user_id", userId)
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .maybeSingle();
  if (!data) {
    const created = await db
      .from("user_trips")
      .insert({ user_id: userId, program_key: TRAVEL_PROGRAM_KEY, status: "planning" })
      .select("*")
      .single();
    data = created.data;
  }
  return data;
}

export async function confirmMarketplaceAttempt(input: {
  userId: string;
  attemptId: string;
  confirmationNumber: string;
  notes?: string | null;
}) {
  const confirmation = String(input.confirmationNumber || "").trim().slice(0, 120);
  if (confirmation.length < 3) throw new Error("A real confirmation or booking reference is required.");

  const attempt = await getMarketplaceAttemptForUser(input.attemptId, input.userId);
  if (!attempt) throw new Error("Booking attempt not found.");
  if (attempt.status === "confirmed") return attempt;
  if (attempt.status === "canceled" || attempt.status === "failed") {
    throw new Error("This booking attempt can no longer be confirmed.");
  }
  assertMarketplaceTransition(attempt.status, "confirmed");

  const db = getSupabaseAdmin();
  const snap = attempt.offer_snapshot || {};
  const now = new Date().toISOString();
  let hotel_reservation_id: string | null = null;
  let itinerary_kind: MarketplaceKind | null = null;
  let itinerary_record_id: string | null = null;

  if (attempt.kind === "hotel") {
    const hotelName = String(snap.name || attempt.destination_label || "Marketplace hotel");
    const roomType = String(snap.roomName || "Marketplace rate");
    const checkIn = String(snap.checkIn || attempt.start_at?.slice(0, 10) || "").slice(0, 10);
    const checkOut = String(snap.checkOut || attempt.end_at?.slice(0, 10) || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut) || checkOut <= checkIn) {
      throw new Error("This hotel offer is missing valid stay dates. Re-search and try again.");
    }
    const { count } = await db
      .from("travel_hotel_reservations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", input.userId)
      .eq("program_key", TRAVEL_PROGRAM_KEY)
      .eq("reservation_status", "confirmed");
    const { data: reservation, error } = await db
      .from("travel_hotel_reservations")
      .insert({
        program_key: TRAVEL_PROGRAM_KEY,
        user_id: input.userId,
        hotel_name_snapshot: hotelName,
        room_type: roomType,
        check_in: checkIn,
        check_out: checkOut,
        confirmation_number: confirmation,
        nightly_rate_cents: attempt.quoted_amount_cents,
        notes: input.notes || `Marketplace provider: ${attempt.provider_key}`,
        booking_source: "marketplace",
        reservation_status: "confirmed",
        primary_stay: (count ?? 0) === 0,
        confirmed_at: now,
      })
      .select("id")
      .single();
    if (error || !reservation) throw new Error(error?.message || "Unable to save hotel reservation.");
    hotel_reservation_id = reservation.id;
    await db.from("travel_hotel_reservation_audit").insert({
      reservation_id: reservation.id,
      actor_user_id: input.userId,
      action: "marketplace_confirmation_added",
      details: { attempt_id: attempt.id, provider: attempt.provider_key },
    });
  } else {
    const trip = await ensureTrip(input.userId);
    if (!trip) throw new Error("Unable to open My Trip.");
    if (attempt.kind === "flight") {
      const { data, error } = await db
        .from("user_trip_flights")
        .insert({
          trip_id: trip.id,
          user_id: input.userId,
          airline: String(snap.airline || attempt.provider_key),
          flight_number: String(snap.flightNumber || ""),
          origin: String(snap.origin || attempt.origin_label || ""),
          destination: String(snap.destination || attempt.destination_label || ""),
          departure_at: snap.departAt || attempt.start_at,
          arrival_at: snap.arriveAt || attempt.end_at,
          confirmation_number: confirmation,
          booked_externally: true,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message || "Unable to save flight.");
      itinerary_kind = "flight";
      itinerary_record_id = data.id;
    } else {
      const { data, error } = await db
        .from("user_trip_cars")
        .insert({
          trip_id: trip.id,
          user_id: input.userId,
          company: String(snap.company || attempt.provider_key),
          confirmation_number: confirmation,
          pickup_at: snap.pickupAt || attempt.start_at,
          dropoff_at: snap.dropoffAt || attempt.end_at,
          booked_externally: true,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message || "Unable to save rental car.");
      itinerary_kind = "car";
      itinerary_record_id = data.id;
    }
    await db
      .from("user_trips")
      .update({ status: "trip_added", updated_at: now })
      .eq("id", trip.id)
      .eq("user_id", input.userId);
  }

  const { data: updated, error: updateError } = await db
    .from("travel_marketplace_booking_attempts")
    .update({
      status: "confirmed",
      confirmation_number: confirmation,
      hotel_reservation_id,
      itinerary_kind,
      itinerary_record_id,
      confirmed_at: now,
      updated_at: now,
    })
    .eq("id", attempt.id)
    .eq("user_id", input.userId)
    .select("*")
    .single();
  if (updateError || !updated) throw new Error(updateError?.message || "Unable to confirm booking attempt.");

  await db.from("travel_analytics_events").insert({
    program_key: TRAVEL_PROGRAM_KEY,
    user_id: input.userId,
    event_name:
      attempt.kind === "hotel" ? "hotel_reservation_confirmed" : "travel_itinerary_added",
    properties: {
      booking_source: "marketplace",
      kind: attempt.kind,
      provider: attempt.provider_key,
      attempt_id: attempt.id,
    },
  });

  return updated as MarketplaceAttempt;
}

export async function cancelMarketplaceAttempt(input: {
  userId: string;
  attemptId: string;
  reason?: string;
}) {
  const existing = await getMarketplaceAttemptForUser(input.attemptId, input.userId);
  if (!existing) return null;
  assertMarketplaceTransition(existing.status, "canceled");

  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("travel_marketplace_booking_attempts")
    .update({
      status: "canceled",
      canceled_at: now,
      updated_at: now,
      failure_reason: input.reason?.slice(0, 500) || null,
    })
    .eq("id", input.attemptId)
    .eq("user_id", input.userId)
    .in("status", ["booking_started", "pending_confirmation"])
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as MarketplaceAttempt | null;
}

export async function recheckMarketplaceAttempt(input: { userId: string; attemptId: string }) {
  const attempt = await getMarketplaceAttemptForUser(input.attemptId, input.userId);
  if (!attempt) throw new Error("Booking attempt not found.");

  const { marketplaceStatus } = await import("./credentials");
  const status = marketplaceStatus();
  const kindKey = attempt.kind === "hotel" ? "hotels" : attempt.kind === "flight" ? "flights" : "cars";
  const lane = status[kindKey];

  if (!lane.configured) {
    return {
      attemptId: attempt.id,
      status: attempt.status,
      code: "provider_not_configured" as const,
      confirmed: attempt.status === "confirmed",
      message:
        "Live provider credentials are not configured. This attempt remains pending until you add a real confirmation number or a provider lookup becomes available.",
    };
  }

  // Partner booking retrieve APIs are not wired for marketplace offers yet.
  // Redirect/return alone never confirms; keep truthful pending state.
  const db = getSupabaseAdmin();
  await db
    .from("travel_marketplace_booking_attempts")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", attempt.id)
    .eq("user_id", input.userId);

  return {
    attemptId: attempt.id,
    status: attempt.status,
    code: "provider_lookup_unavailable" as const,
    confirmed: attempt.status === "confirmed",
    message:
      "Authoritative provider booking lookup is not available for this attempt. Add your confirmation number when the partner booking is complete.",
  };
}

export async function listOwnerMarketplaceAttempts(filters: {
  q?: string;
  provider?: string;
  kind?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  staleOnly?: boolean;
}) {
  const db = getSupabaseAdmin();
  let query = db
    .from("travel_marketplace_booking_attempts")
    .select("*")
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .order("started_at", { ascending: false })
    .limit(200);
  if (filters.provider) query = query.eq("provider_key", filters.provider);
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.dateFrom) query = query.gte("started_at", `${filters.dateFrom}T00:00:00.000Z`);
  if (filters.dateTo) query = query.lte("started_at", `${filters.dateTo}T23:59:59.999Z`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  let rows = (data ?? []) as MarketplaceAttempt[];
  if (filters.staleOnly) {
    const now = Date.now();
    rows = rows.filter((row) => isStaleMarketplaceAttempt(row, now));
  }
  const q = filters.q?.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    const hay = [
      row.id,
      row.user_id,
      row.kind,
      row.provider_key,
      row.status,
      row.destination_label,
      row.origin_label,
      row.confirmation_number,
      row.offer_id,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function marketplaceExceptionQueues(attempts: MarketplaceAttempt[], now = Date.now()) {
  const open = attempts.filter(
    (a) => a.status === "booking_started" || a.status === "pending_confirmation",
  );
  return {
    booking_started_unconfirmed: attempts.filter((a) => a.status === "booking_started"),
    pending_confirmation: attempts.filter((a) => a.status === "pending_confirmation"),
    missing_reference: attempts.filter(
      (a) => a.status === "pending_confirmation" && !a.confirmation_number,
    ),
    stale_pending_review: open.filter((a) => isStaleMarketplaceAttempt(a, now)),
    failed: attempts.filter((a) => a.status === "failed"),
    canceled: attempts.filter((a) => a.status === "canceled"),
    confirmed: attempts.filter((a) => a.status === "confirmed"),
  };
}
