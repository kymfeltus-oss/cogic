/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
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
      currency: String(offer?.total_currency || "USD"),
      bookingUrl: null,
    };
  });
}
