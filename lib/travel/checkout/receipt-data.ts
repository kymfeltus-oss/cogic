import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { TRAVEL_PROGRAM_KEY } from "@/lib/travel/types";
import {
  getCheckoutAttemptById,
  type TravelCheckoutAttempt,
} from "@/lib/travel/checkout/repository";

export type TravelBookingTransactionRow = {
  id: string;
  user_id: string;
  marketplace_attempt_id: string | null;
  kind: string;
  status: string;
  provider_key: string | null;
  payment_intent_id: string | null;
  supplier_confirmation_number: string | null;
  total_amount_cents: number | null;
  tax_amount_cents: number | null;
  currency: string;
  destination_label: string | null;
  origin_label: string | null;
  start_at: string | null;
  end_at: string | null;
  confirmed_at: string | null;
  failure_reason: string | null;
  offer_snapshot: Record<string, unknown> | null;
  started_at: string | null;
  updated_at: string;
};

export type TravelReceiptBundle = {
  transaction: TravelBookingTransactionRow | null;
  attempt: TravelCheckoutAttempt | null;
};

const TXN_SELECT =
  "id,user_id,marketplace_attempt_id,kind,status,provider_key,payment_intent_id,supplier_confirmation_number,total_amount_cents,tax_amount_cents,currency,destination_label,origin_label,start_at,end_at,confirmed_at,failure_reason,offer_snapshot,started_at,updated_at";

export async function getTravelBookingTransactionById(transactionId: string) {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("travel_booking_transactions")
    .select(TXN_SELECT)
    .eq("id", transactionId)
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TravelBookingTransactionRow | null) ?? null;
}

export async function getTravelBookingTransactionByAttemptId(attemptId: string) {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("travel_booking_transactions")
    .select(TXN_SELECT)
    .eq("marketplace_attempt_id", attemptId)
    .eq("program_key", TRAVEL_PROGRAM_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TravelBookingTransactionRow | null) ?? null;
}

export async function loadTravelReceiptBundle(input: {
  transactionId?: string | null;
  attemptId?: string | null;
}): Promise<TravelReceiptBundle | null> {
  const transactionId = String(input.transactionId || "").trim();
  const attemptId = String(input.attemptId || "").trim();

  let transaction: TravelBookingTransactionRow | null = null;
  if (transactionId) {
    transaction = await getTravelBookingTransactionById(transactionId);
  } else if (attemptId) {
    transaction = await getTravelBookingTransactionByAttemptId(attemptId);
  }

  const linkedAttemptId =
    String(transaction?.marketplace_attempt_id || "").trim() || attemptId || "";
  const attempt = linkedAttemptId
    ? await getCheckoutAttemptById(linkedAttemptId)
    : null;

  if (!transaction && !attempt) return null;
  return { transaction, attempt };
}

export function formatCentsAsDollars(
  cents: number | null | undefined,
  currency = "USD",
): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  const code = (currency || "USD").toUpperCase();
  if (code === "USD") {
    const sign = cents < 0 ? "-" : "";
    const abs = Math.abs(Math.round(cents));
    const dollars = Math.floor(abs / 100);
    const remainder = String(abs % 100).padStart(2, "0");
    return `${sign}$${dollars}.${remainder}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
  }).format(cents / 100);
}

export function guestDisplayName(
  offerSnapshot: Record<string, unknown> | null | undefined,
  fallbackEmail?: string | null,
): string {
  const snap = offerSnapshot && typeof offerSnapshot === "object" ? offerSnapshot : {};
  const guest =
    snap.guest && typeof snap.guest === "object"
      ? (snap.guest as Record<string, unknown>)
      : {};
  const given = String(guest.givenName || snap.givenName || "").trim();
  const family = String(guest.familyName || snap.familyName || "").trim();
  const combined = [given, family].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  const email = String(guest.email || fallbackEmail || "").trim();
  return email || "Guest Traveler";
}

export function itineraryDescriptors(input: {
  kind: string;
  originLabel: string | null;
  destinationLabel: string | null;
  startAt: string | null;
  endAt: string | null;
  offerSnapshot: Record<string, unknown> | null | undefined;
}): Array<{ label: string; value: string }> {
  const offer =
    input.offerSnapshot && typeof input.offerSnapshot === "object"
      ? input.offerSnapshot
      : {};
  const kind = String(input.kind || "").toLowerCase();
  const rows: Array<{ label: string; value: string }> = [];

  const route =
    [input.originLabel, input.destinationLabel].filter(Boolean).join(" → ") ||
    input.destinationLabel ||
    "";

  if (kind === "hotel") {
    rows.push({
      label: "Property",
      value: String(offer.name || input.destinationLabel || "Hotel stay").trim(),
    });
    rows.push({
      label: "Room / rate",
      value: String(offer.roomName || "Selected rate").trim(),
    });
    if (route) rows.push({ label: "Location", value: route });
  } else if (kind === "flight") {
    rows.push({
      label: "Route",
      value:
        route ||
        `${String(offer.origin || "").trim()} → ${String(offer.destination || "").trim()}`,
    });
    rows.push({
      label: "Flight",
      value: String(offer.flightNumber || offer.airline || "Selected flight").trim(),
    });
    rows.push({
      label: "Cabin",
      value: String(offer.cabin || "Economy").trim(),
    });
  } else if (kind === "car") {
    rows.push({
      label: "Vehicle",
      value: String(offer.vehicleName || offer.company || "Rental car").trim(),
    });
    rows.push({
      label: "Pickup",
      value: String(offer.pickupLocation || input.originLabel || "—").trim(),
    });
    rows.push({
      label: "Drop-off",
      value: String(
        offer.dropoffLocation || offer.pickupLocation || input.destinationLabel || "—",
      ).trim(),
    });
  } else if (route) {
    rows.push({ label: "Itinerary", value: route });
  }

  if (input.startAt) {
    rows.push({
      label: kind === "hotel" ? "Check-in" : kind === "car" ? "Pickup at" : "Depart",
      value: new Date(input.startAt).toLocaleString("en-US"),
    });
  }
  if (input.endAt) {
    rows.push({
      label: kind === "hotel" ? "Check-out" : kind === "car" ? "Drop-off at" : "Arrive",
      value: new Date(input.endAt).toLocaleString("en-US"),
    });
  }

  return rows.filter((row) => row.value && row.value !== "→");
}
