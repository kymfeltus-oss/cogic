/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createHash } from "crypto";
import type { MarketplaceCarOffer, MarketplaceHotelOffer } from "./types";

function authHeader() {
  const apiKey = process.env.EXPEDIA_RAPID_API_KEY?.trim();
  const secret = process.env.EXPEDIA_RAPID_API_SECRET?.trim();
  if (!apiKey || !secret) return null;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHash("sha512").update(apiKey + secret + timestamp).digest("hex");
  return `EAN apikey=${apiKey},signature=${signature},timestamp=${timestamp}`;
}

function baseUrl() {
  return (process.env.EXPEDIA_RAPID_BASE_URL?.trim() || "https://api.ean.com").replace(/\/$/, "");
}

async function rapidGet(path: string, query: Record<string, string>) {
  const authorization = authHeader();
  if (!authorization) throw new Error("Expedia Rapid is not configured.");
  const url = new URL(`${baseUrl()}${path}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: authorization,
      "Customer-Ip": "127.0.0.1",
      "User-Agent": "COGIC-LIVE/1.0",
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : `Expedia Rapid request failed (${response.status}).`,
    );
  }
  return body;
}

function moneyToCents(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

export async function searchExpediaHotels(input: {
  destination: string;
  checkIn: string;
  checkOut: string;
  adults?: number;
}): Promise<MarketplaceHotelOffer[]> {
  // Region resolve → property availability. Exact Rapid paths depend on affiliate contract.
  const region = await rapidGet("/v3/regions", {
    language: "en-US",
    include: "details",
    "billing-terms": "AGREED",
    "partner-point-of-sale": process.env.EXPEDIA_RAPID_PARTNER_POS?.trim() || "browser",
    "payment-terms": "AGREED",
    query: input.destination,
  }).catch(() => null);

  const regionId =
    region?.data?.[0]?.id ||
    region?.[0]?.id ||
    region?.region_id ||
    null;

  if (!regionId) {
    throw new Error("No US destination matched that search.");
  }

  const availability = await rapidGet("/v3/properties/availability", {
    language: "en-US",
    checkin: input.checkIn,
    checkout: input.checkOut,
    currency: "USD",
    country_code: "US",
    occupancy: String(input.adults && input.adults > 0 ? input.adults : 2),
    region_id: String(regionId),
    rate_plan_count: "1",
    sales_channel: "website",
    sales_environment: "hotel_only",
    sort_type: "preferred",
    "billing-terms": "AGREED",
    "partner-point-of-sale": process.env.EXPEDIA_RAPID_PARTNER_POS?.trim() || "browser",
    "payment-terms": "AGREED",
  });

  const rows = Array.isArray(availability) ? availability : availability?.data || [];
  return rows.slice(0, 40).map((row: any, index: number): MarketplaceHotelOffer => {
    const room = row?.rooms?.[0] || row?.room_types?.[0] || {};
    const rate = room?.rates?.[0] || row?.rates?.[0] || {};
    const total =
      rate?.occupancy_pricing?.["2"]?.totals?.inclusive?.request_currency?.value ||
      rate?.occupancy_pricing?.["1"]?.totals?.inclusive?.request_currency?.value ||
      rate?.total ||
      null;
    const nightly =
      rate?.occupancy_pricing?.["2"]?.totals?.exclusive?.request_currency?.value ||
      rate?.nightly?.[0]?.[0]?.value ||
      null;
    return {
      id: String(row?.property_id || row?.id || `expedia-hotel-${index}`),
      provider: "expedia-rapid",
      name: String(row?.name || row?.property_name || "Hotel"),
      address: row?.address?.line_1 || row?.address || null,
      city: row?.address?.city || null,
      state: row?.address?.state_province_code || row?.address?.state || null,
      country: row?.address?.country_code || "US",
      starRating: Number(row?.ratings?.property?.rating || row?.star_rating || NaN) || null,
      nightlyRateCents: moneyToCents(nightly),
      totalRateCents: moneyToCents(total),
      currency: "USD",
      roomName: room?.room_name || room?.name || null,
      cancelPolicy: rate?.cancel_penalties?.[0]?.description || null,
      bookingUrl: row?.links?.web?.href || row?.booking_url || null,
      imageUrl: row?.images?.[0]?.links?.["1000px"]?.href || row?.image_url || null,
    };
  });
}

export async function searchExpediaCars(input: {
  pickupLocation: string;
  dropoffLocation: string;
  pickupAt: string;
  dropoffAt: string;
}): Promise<MarketplaceCarOffer[]> {
  // Cars inventory depends on Rapid cars product entitlement for the affiliate.
  const body = await rapidGet("/v3/cars/availability", {
    language: "en-US",
    currency: "USD",
    pickup_date: input.pickupAt.slice(0, 10),
    pickup_time: input.pickupAt.slice(11, 16) || "10:00",
    dropoff_date: input.dropoffAt.slice(0, 10),
    dropoff_time: input.dropoffAt.slice(11, 16) || "10:00",
    pickup_search: input.pickupLocation,
    dropoff_search: input.dropoffLocation || input.pickupLocation,
    "billing-terms": "AGREED",
    "partner-point-of-sale": process.env.EXPEDIA_RAPID_PARTNER_POS?.trim() || "browser",
    "payment-terms": "AGREED",
  });

  const rows = Array.isArray(body) ? body : body?.data || body?.cars || [];
  return rows.slice(0, 40).map((row: any, index: number): MarketplaceCarOffer => ({
    id: String(row?.id || row?.offer_id || `expedia-car-${index}`),
    provider: "expedia-rapid",
    company: row?.vendor?.name || row?.company || null,
    vehicleName: row?.vehicle?.name || row?.name || null,
    vehicleClass: row?.vehicle?.category || row?.vehicle_class || null,
    pickupLocation: input.pickupLocation,
    dropoffLocation: input.dropoffLocation || input.pickupLocation,
    pickupAt: input.pickupAt,
    dropoffAt: input.dropoffAt,
    totalRateCents: moneyToCents(
      row?.price?.total || row?.rates?.[0]?.total || row?.total_price,
    ),
    currency: String(row?.price?.currency || "USD"),
    bookingUrl: row?.links?.web?.href || row?.booking_url || null,
  }));
}
