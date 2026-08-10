/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import type { MarketplaceCarOffer, MarketplaceFlightOffer, MarketplaceHotelOffer } from "./types";

/**
 * Enterprise Amadeus adapter.
 * Self-service portal was decommissioned July 2026 — requires AMADEUS_API_KEY + AMADEUS_API_SECRET
 * and AMADEUS_BASE_URL pointing at the contracted enterprise/test host.
 */

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

function baseUrl() {
  return (process.env.AMADEUS_BASE_URL?.trim() || "https://api.amadeus.com").replace(/\/$/, "");
}

async function amadeusToken() {
  const key = process.env.AMADEUS_API_KEY?.trim();
  const secret = process.env.AMADEUS_API_SECRET?.trim();
  if (!key || !secret) throw new Error("Amadeus is not configured.");
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;

  const response = await fetch(`${baseUrl()}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: key,
      client_secret: secret,
    }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.access_token) {
    throw new Error(body?.error_description || "Amadeus authentication failed.");
  }
  tokenCache = {
    token: String(body.access_token),
    expiresAt: Date.now() + Number(body.expires_in || 1799) * 1000,
  };
  return tokenCache.token;
}

async function amadeusGet(path: string, query: Record<string, string>) {
  const url = new URL(`${baseUrl()}${path}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${await amadeusToken()}` },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.errors?.[0]?.detail || `Amadeus request failed (${response.status}).`);
  }
  return body;
}

function moneyToCents(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

export async function searchAmadeusHotels(input: {
  destination: string;
  checkIn: string;
  checkOut: string;
  adults?: number;
}): Promise<MarketplaceHotelOffer[]> {
  const city = await amadeusGet("/v1/reference-data/locations", {
    keyword: input.destination,
    subType: "CITY",
    countryCode: "US",
  });
  const cityCode = city?.data?.[0]?.iataCode || city?.data?.[0]?.address?.cityCode;
  if (!cityCode) throw new Error("No US city matched that hotel destination.");

  const hotels = await amadeusGet("/v1/reference-data/locations/hotels/by-city", {
    cityCode: String(cityCode),
  });
  const hotelIds = (hotels?.data || []).slice(0, 20).map((h: any) => h.hotelId).filter(Boolean);
  if (!hotelIds.length) return [];

  const offers = await amadeusGet("/v3/shopping/hotel-offers", {
    hotelIds: hotelIds.join(","),
    adults: String(input.adults && input.adults > 0 ? input.adults : 2),
    checkInDate: input.checkIn,
    checkOutDate: input.checkOut,
    currency: "USD",
    bestRateOnly: "true",
  });

  return (offers?.data || []).slice(0, 40).map((row: any): MarketplaceHotelOffer => {
    const offer = row?.offers?.[0];
    return {
      id: String(offer?.id || row?.hotel?.hotelId),
      provider: "amadeus",
      name: String(row?.hotel?.name || "Hotel"),
      address: row?.hotel?.address?.lines?.[0] || null,
      city: row?.hotel?.address?.cityName || null,
      state: row?.hotel?.address?.stateCode || null,
      country: row?.hotel?.address?.countryCode || "US",
      starRating: Number(row?.hotel?.rating || NaN) || null,
      nightlyRateCents: null,
      totalRateCents: moneyToCents(offer?.price?.total),
      currency: String(offer?.price?.currency || "USD"),
      roomName: offer?.room?.description?.text || offer?.room?.typeEstimated?.category || null,
      cancelPolicy: offer?.policies?.cancellation?.description?.text || null,
      bookingUrl: null,
      imageUrl: null,
    };
  });
}

export async function searchAmadeusFlights(input: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string | null;
  adults?: number;
  cabin?: string;
}): Promise<MarketplaceFlightOffer[]> {
  const query: Record<string, string> = {
    originLocationCode: input.origin.trim().toUpperCase(),
    destinationLocationCode: input.destination.trim().toUpperCase(),
    departureDate: input.departDate,
    adults: String(Math.max(1, input.adults || 1)),
    currencyCode: "USD",
    max: "40",
  };
  if (input.returnDate) query.returnDate = input.returnDate;
  if (input.cabin) query.travelClass = input.cabin.toUpperCase().replace(/\s+/g, "_");

  const body = await amadeusGet("/v2/shopping/flight-offers", query);
  return (body?.data || []).map((offer: any): MarketplaceFlightOffer => {
    const itinerary = offer?.itineraries?.[0];
    const segment = itinerary?.segments?.[0];
    const last = itinerary?.segments?.[itinerary.segments.length - 1];
    return {
      id: String(offer.id),
      provider: "amadeus",
      airline: segment?.carrierCode || null,
      flightNumber: segment ? `${segment.carrierCode}${segment.number}` : null,
      origin: String(segment?.departure?.iataCode || input.origin).toUpperCase(),
      destination: String(last?.arrival?.iataCode || input.destination).toUpperCase(),
      departAt: segment?.departure?.at || null,
      arriveAt: last?.arrival?.at || null,
      cabin: offer?.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin || input.cabin || null,
      stops: Math.max(0, (itinerary?.segments?.length || 1) - 1),
      totalFareCents: moneyToCents(offer?.price?.grandTotal || offer?.price?.total),
      currency: String(offer?.price?.currency || "USD"),
      bookingUrl: null,
    };
  });
}

export async function searchAmadeusCars(input: {
  pickupLocation: string;
  dropoffLocation: string;
  pickupAt: string;
  dropoffAt: string;
}): Promise<MarketplaceCarOffer[]> {
  // Transfer/car endpoints vary by enterprise catalog entitlement.
  const body = await amadeusGet("/v1/shopping/transfer-offers", {
    startLocationCode: input.pickupLocation.trim().toUpperCase().slice(0, 3),
    endLocationCode: (input.dropoffLocation || input.pickupLocation).trim().toUpperCase().slice(0, 3),
    startDateTime: `${input.pickupAt}:00`,
    passengers: "1",
  });

  return (body?.data || []).slice(0, 40).map((row: any, index: number): MarketplaceCarOffer => ({
    id: String(row?.id || `amadeus-car-${index}`),
    provider: "amadeus",
    company: row?.serviceProvider?.name || row?.vendor?.name || null,
    vehicleName: row?.vehicle?.description || row?.vehicle?.code || null,
    vehicleClass: row?.vehicle?.category || null,
    pickupLocation: input.pickupLocation,
    dropoffLocation: input.dropoffLocation || input.pickupLocation,
    pickupAt: input.pickupAt,
    dropoffAt: input.dropoffAt,
    totalRateCents: moneyToCents(row?.quotation?.monetaryAmount || row?.price?.total),
    currency: String(row?.quotation?.currencyCode || row?.price?.currency || "USD"),
    bookingUrl: null,
  }));
}
