/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { travelDemoModeEnabled } from "./credentials";
import type { MarketplaceFlightOffer } from "./types";

function token() {
  const value = process.env.DUFFEL_ACCESS_TOKEN?.trim();
  if (!value) throw new Error("Duffel is not configured.");
  return value;
}

function baseUrl() {
  return (process.env.DUFFEL_BASE_URL?.trim() || "https://api.duffel.com").replace(/\/$/, "");
}

async function duffelFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Duffel-Version": process.env.DUFFEL_API_VERSION?.trim() || "v2",
      Authorization: `Bearer ${token()}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body?.errors?.[0]?.message ||
      body?.message ||
      `Duffel request failed (${response.status}).`;
    throw new Error(String(message));
  }
  return body;
}

function moneyToCents(amount: unknown) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export async function searchDuffelFlights(input: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string | null;
  adults?: number;
  cabin?: string;
}): Promise<MarketplaceFlightOffer[]> {
  const slices = [
    {
      origin: input.origin.trim().toUpperCase(),
      destination: input.destination.trim().toUpperCase(),
      departure_date: input.departDate,
    },
  ];
  if (input.returnDate) {
    slices.push({
      origin: input.destination.trim().toUpperCase(),
      destination: input.origin.trim().toUpperCase(),
      departure_date: input.returnDate,
    });
  }

  const cabin = (input.cabin || "economy").toLowerCase().replace(/\s+/g, "_");
  const created = await duffelFetch("/air/offer_requests", {
    method: "POST",
    body: JSON.stringify({
      data: {
        slices,
        passengers: Array.from({ length: Math.max(1, input.adults || 1) }, () => ({
          type: "adult",
        })),
        cabin_class: cabin === "premium_economy" ? "premium_economy" : cabin,
        max_connections: 1,
      },
    }),
  });

  const offers = created?.data?.offers || [];
  return offers.slice(0, 40).map((offer: any): MarketplaceFlightOffer => {
    const slice = offer?.slices?.[0];
    const segment = slice?.segments?.[0];
    const last = slice?.segments?.[slice.segments.length - 1];
    return {
      id: String(offer.id),
      provider: "duffel",
      airline: segment?.marketing_carrier?.name || segment?.operating_carrier?.name || null,
      flightNumber: segment?.marketing_carrier_flight_number
        ? `${segment?.marketing_carrier?.iata_code || ""}${segment.marketing_carrier_flight_number}`
        : null,
      origin: String(segment?.origin?.iata_code || input.origin).toUpperCase(),
      destination: String(last?.destination?.iata_code || input.destination).toUpperCase(),
      departAt: segment?.departing_at || null,
      arriveAt: last?.arriving_at || null,
      cabin: offer?.cabin_class || input.cabin || null,
      stops: Math.max(0, (slice?.segments?.length || 1) - 1),
      totalFareCents: moneyToCents(offer?.total_amount),
      taxAmountCents: moneyToCents(offer?.tax_amount),
      currency: String(offer?.total_currency || "USD"),
      bookingUrl: null,
      bookToken: String(offer.id),
    };
  });
}

/** Live order retrieve for operator sync / webhook reconciliation. */
export async function retrieveDuffelOrder(orderIdOrReference: string): Promise<{
  confirmationNumber: string;
  orderId: string;
  canceled: boolean;
  departureAt: string | null;
  arrivalAt: string | null;
  raw: Record<string, unknown>;
}> {
  const key = String(orderIdOrReference || "").trim();
  if (!key) throw new Error("Duffel order id or booking reference is required.");

  let order: any = null;
  try {
    const byId = await duffelFetch(`/air/orders/${encodeURIComponent(key)}`);
    order = byId?.data;
  } catch {
    const listed = await duffelFetch(
      `/air/orders?booking_reference=${encodeURIComponent(key)}`,
    );
    order = Array.isArray(listed?.data) ? listed.data[0] : listed?.data;
  }

  if (!order?.id) throw new Error("Duffel order was not found at the supplier.");
  const slice = order?.slices?.[0];
  const segments = Array.isArray(slice?.segments) ? slice.segments : [];
  const first = segments[0];
  const last = segments[segments.length - 1];
  const confirmationNumber = String(order.booking_reference || order.id).trim();
  const canceled = Boolean(order.cancelled_at || /cancel/i.test(String(order?.status || "")));
  return {
    confirmationNumber,
    orderId: String(order.id),
    canceled,
    departureAt: first?.departing_at || slice?.departure_datetime || null,
    arrivalAt: last?.arriving_at || slice?.arrival_datetime || null,
    raw: order as Record<string, unknown>,
  };
}

/** Static sandbox flight offer id when USE_MOCK_TRAVEL=true (non-production only). */
export const TRAVEL_DEMO_DUFFEL_OFFER_ID = "mock_sandbox_offer_flight_2201";
export const TRAVEL_DEMO_DUFFEL_TOTAL_CENTS = 32050;

export async function getDuffelOffer(offerId: string): Promise<{
  id: string;
  totalFareCents: number;
  totalAmountCents?: number;
  taxAmountCents: number | null;
  currency: string;
  passengerIds: string[];
  raw: Record<string, unknown>;
}> {
  if (String(process.env.USE_MOCK_TRAVEL || "").trim() === "true") {
    if (!travelDemoModeEnabled()) {
      throw new Error(
        "USE_MOCK_TRAVEL is set but travel demo mode is not allowed (disabled when VERCEL_ENV=production).",
      );
    }
    const requestedOfferId = String(offerId || "").trim();
    console.warn("[travel.demo] getDuffelOffer — USE_MOCK_TRAVEL interceptor (sandbox vault).");
    return {
      id: TRAVEL_DEMO_DUFFEL_OFFER_ID,
      totalFareCents: TRAVEL_DEMO_DUFFEL_TOTAL_CENTS,
      totalAmountCents: TRAVEL_DEMO_DUFFEL_TOTAL_CENTS,
      taxAmountCents: 0,
      currency: "USD",
      passengerIds: ["pas_demo_1"],
      raw: {
        demo: true,
        pricedBy: "USE_MOCK_TRAVEL",
        totalAmountCents: TRAVEL_DEMO_DUFFEL_TOTAL_CENTS,
        offerId: TRAVEL_DEMO_DUFFEL_OFFER_ID,
        requestedOfferId,
        provider: "duffel",
      },
    };
  }

  const id = String(offerId || "").trim();
  if (!id) throw new Error("A live Duffel offer_id is required.");

  const body = await duffelFetch(`/air/offers/${encodeURIComponent(id)}`);
  const offer = body?.data;
  if (!offer?.id) throw new Error("Duffel offer is no longer available.");
  const totalFareCents = moneyToCents(offer.total_amount);
  if (totalFareCents == null || totalFareCents <= 0) {
    throw new Error("Duffel offer is missing a live fare.");
  }
  return {
    id: String(offer.id),
    totalFareCents,
    taxAmountCents: moneyToCents(offer.tax_amount),
    currency: String(offer.total_currency || "USD").toUpperCase(),
    passengerIds: Array.isArray(offer.passengers)
      ? offer.passengers.map((p: any) => String(p.id)).filter(Boolean)
      : [],
    raw: offer as Record<string, unknown>,
  };
}

export type DuffelPassengerInput = {
  id: string;
  title?: string;
  givenName: string;
  familyName: string;
  bornOn: string;
  gender: "m" | "f";
  email: string;
  phoneNumber: string;
};

export async function createDuffelOrder(input: {
  offerId: string;
  amount: string;
  currency: string;
  passengers: DuffelPassengerInput[];
}) {
  const body = await duffelFetch("/air/orders", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "instant",
        selected_offers: [input.offerId],
        passengers: input.passengers.map((passenger) => ({
          id: passenger.id,
          title: passenger.title || "mr",
          given_name: passenger.givenName,
          family_name: passenger.familyName,
          born_on: passenger.bornOn,
          gender: passenger.gender,
          email: passenger.email,
          phone_number: passenger.phoneNumber,
        })),
        payments: [
          {
            type: "balance",
            amount: input.amount,
            currency: input.currency,
          },
        ],
      },
    }),
  });

  const order = body?.data;
  const confirmationNumber = String(
    order?.booking_reference || order?.id || "",
  ).trim();
  if (confirmationNumber.length < 3) {
    throw new Error("Duffel order completed without a booking reference.");
  }
  return {
    confirmationNumber,
    orderId: order?.id ? String(order.id) : confirmationNumber,
    raw: (order && typeof order === "object" ? order : { order }) as Record<string, unknown>,
  };
}
