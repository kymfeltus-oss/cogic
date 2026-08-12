/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createHash } from "crypto";
import { travelDemoModeEnabled } from "./credentials";
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

async function rapidRequest(
  method: "GET" | "POST",
  path: string,
  query: Record<string, string> = {},
  payload?: unknown,
) {
  const authorization = authHeader();
  if (!authorization) throw new Error("Expedia Rapid is not configured.");
  const url = new URL(`${baseUrl()}${path}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: authorization,
      "Customer-Ip": "127.0.0.1",
      "User-Agent": "COGIC-LIVE/1.0",
      ...(payload ? { "Content-Type": "application/json" } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : typeof body?.errors?.[0]?.message === "string"
          ? body.errors[0].message
          : `Expedia Rapid request failed (${response.status}).`,
    );
  }
  return body;
}

async function rapidGet(path: string, query: Record<string, string>) {
  return rapidRequest("GET", path, query);
}

async function rapidPost(path: string, payload: unknown, query: Record<string, string> = {}) {
  return rapidRequest("POST", path, query, payload);
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
    const pricing =
      rate?.occupancy_pricing?.["2"] ||
      rate?.occupancy_pricing?.["1"] ||
      Object.values(rate?.occupancy_pricing || {})[0] ||
      null;
    const total =
      pricing?.totals?.inclusive?.request_currency?.value ||
      rate?.total ||
      null;
    const nightly =
      pricing?.totals?.exclusive?.request_currency?.value ||
      rate?.nightly?.[0]?.[0]?.value ||
      null;
    const tax =
      pricing?.totals?.taxes?.request_currency?.value ||
      pricing?.totals?.property_fees?.request_currency?.value ||
      null;
    const propertyId = String(row?.property_id || row?.id || `expedia-hotel-${index}`);
    const bookToken = String(
      rate?.id ||
        rate?.bed_groups?.[0]?.links?.book?.href ||
        room?.id ||
        "",
    ) || null;
    const bedGroupId = rate?.bed_groups?.[0]?.id ? String(rate.bed_groups[0].id) : null;
    const latitude = Number(
      row?.location?.coordinates?.latitude ??
        row?.coordinates?.latitude ??
        row?.latitude ??
        NaN,
    );
    const longitude = Number(
      row?.location?.coordinates?.longitude ??
        row?.coordinates?.longitude ??
        row?.longitude ??
        NaN,
    );
    return {
      id: bookToken ? `${propertyId}:${bookToken}` : propertyId,
      provider: "expedia-rapid",
      name: String(row?.name || row?.property_name || "Hotel"),
      address: row?.address?.line_1 || row?.address || null,
      city: row?.address?.city || null,
      state: row?.address?.state_province_code || row?.address?.state || null,
      country: row?.address?.country_code || "US",
      starRating: Number(row?.ratings?.property?.rating || row?.star_rating || NaN) || null,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      nightlyRateCents: moneyToCents(nightly),
      totalRateCents: moneyToCents(total),
      taxAmountCents: moneyToCents(tax),
      currency: "USD",
      roomName: room?.room_name || room?.name || null,
      cancelPolicy: rate?.cancel_penalties?.[0]?.description || null,
      bookingUrl: row?.links?.web?.href || row?.booking_url || null,
      imageUrl: row?.images?.[0]?.links?.["1000px"]?.href || row?.image_url || null,
      propertyId,
      bookToken,
      bedGroupId,
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
  return rows.slice(0, 40).map((row: any, index: number): MarketplaceCarOffer => {
    const bookToken = String(row?.id || row?.offer_id || row?.rate?.id || `expedia-car-${index}`);
    return {
      id: bookToken,
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
      taxAmountCents: moneyToCents(row?.price?.taxes || row?.rates?.[0]?.taxes || null),
      currency: String(row?.price?.currency || "USD"),
      bookingUrl: row?.links?.web?.href || row?.booking_url || null,
      bookToken,
    };
  });
}

export type ExpediaBookGuest = {
  givenName: string;
  familyName: string;
  email: string;
  phone?: string | null;
};

export type ExpediaBookResult = {
  confirmationNumber: string;
  raw: Record<string, unknown>;
};

function extractExpediaConfirmation(body: any): string | null {
  const candidates = [
    body?.itinerary_id,
    body?.itineraryId,
    body?.confirmation_id,
    body?.rooms?.[0]?.confirmation_id,
    body?.data?.itinerary_id,
    body?.data?.confirmation_id,
  ];
  for (const value of candidates) {
    const text = String(value || "").trim();
    if (text.length >= 3) return text;
  }
  return null;
}

export type ExpediaLivePrice = {
  totalRateCents: number;
  /** Present on USE_MOCK_TRAVEL sandbox frames; mirrors totalRateCents for structural demos. */
  totalAmountCents?: number;
  taxAmountCents: number;
  currency: string;
  bookToken: string;
  bedGroupId: string | null;
  propertyId: string | null;
  raw: Record<string, unknown>;
};

/** Static sandbox tokens returned when USE_MOCK_TRAVEL=true (non-production only). */
export const TRAVEL_DEMO_HOTEL_BOOK_TOKEN = "mock_sandbox_token_hotel_9982";
export const TRAVEL_DEMO_CAR_BOOK_TOKEN = "mock_sandbox_token_car_4412";
export const TRAVEL_DEMO_HOTEL_TOTAL_CENTS = 15000;
export const TRAVEL_DEMO_CAR_TOTAL_CENTS = 7500;

function assertTravelDemoModeAllowed() {
  if (!travelDemoModeEnabled()) {
    throw new Error(
      "USE_MOCK_TRAVEL is set but travel demo mode is not allowed (disabled when VERCEL_ENV=production).",
    );
  }
}

function extractRateMoney(rate: any): { totalCents: number | null; taxCents: number } {
  const pricing =
    rate?.occupancy_pricing?.["2"] ||
    rate?.occupancy_pricing?.["1"] ||
    Object.values(rate?.occupancy_pricing || {})[0] ||
    null;
  const total =
    pricing?.totals?.inclusive?.request_currency?.value ||
    rate?.total ||
    rate?.price?.total ||
    null;
  const tax =
    pricing?.totals?.taxes?.request_currency?.value ||
    pricing?.totals?.property_fees?.request_currency?.value ||
    rate?.price?.taxes ||
    null;
  return {
    totalCents: moneyToCents(total),
    taxCents: moneyToCents(tax) ?? 0,
  };
}

/**
 * Server-authoritative hotel reprice before Stripe PaymentIntent creation.
 * Re-fetches Rapid availability for the property and matches the room package token.
 * Local sandbox: USE_MOCK_TRAVEL=true (non-production) bypasses Rapid and returns a demo frame.
 */
export async function priceCheckExpediaHotel(input: {
  propertyId: string;
  bookToken: string;
  bedGroupId?: string | null;
  checkIn: string;
  checkOut: string;
  adults?: number;
}): Promise<ExpediaLivePrice> {
  if (String(process.env.USE_MOCK_TRAVEL || "").trim() === "true") {
    assertTravelDemoModeAllowed();
    const propertyId = String(input.propertyId || "").trim() || "demo_property";
    const requestedBookToken = String(input.bookToken || "").trim();
    console.warn("[travel.demo] priceCheckExpediaHotel — USE_MOCK_TRAVEL interceptor (sandbox vault).");
    return {
      totalRateCents: TRAVEL_DEMO_HOTEL_TOTAL_CENTS,
      totalAmountCents: TRAVEL_DEMO_HOTEL_TOTAL_CENTS,
      taxAmountCents: 0,
      currency: "USD",
      bookToken: TRAVEL_DEMO_HOTEL_BOOK_TOKEN,
      bedGroupId: input.bedGroupId ? String(input.bedGroupId).trim() : null,
      propertyId,
      raw: {
        demo: true,
        pricedBy: "USE_MOCK_TRAVEL",
        totalAmountCents: TRAVEL_DEMO_HOTEL_TOTAL_CENTS,
        bookToken: TRAVEL_DEMO_HOTEL_BOOK_TOKEN,
        requestedBookToken,
        propertyId,
        provider: "expedia",
      },
    };
  }

  const propertyId = String(input.propertyId || "").trim();
  const bookToken = String(input.bookToken || "").trim();
  if (!propertyId || !bookToken) {
    throw new Error("Expedia hotel price check requires propertyId and bookToken.");
  }
  if (!input.checkIn || !input.checkOut || input.checkOut <= input.checkIn) {
    throw new Error("Expedia hotel price check requires valid check-in and check-out dates.");
  }

  const availability = await rapidGet("/v3/properties/availability", {
    language: "en-US",
    checkin: input.checkIn,
    checkout: input.checkOut,
    currency: "USD",
    country_code: "US",
    occupancy: String(input.adults && input.adults > 0 ? input.adults : 2),
    property_id: propertyId,
    rate_plan_count: "25",
    sales_channel: "website",
    sales_environment: "hotel_only",
    "billing-terms": "AGREED",
    "partner-point-of-sale": process.env.EXPEDIA_RAPID_PARTNER_POS?.trim() || "browser",
    "payment-terms": "AGREED",
  });

  const rows = Array.isArray(availability) ? availability : availability?.data || [];
  const property =
    rows.find((row: any) => String(row?.property_id || row?.id || "") === propertyId) || rows[0];
  if (!property) {
    throw new Error("Expedia Rapid no longer has availability for that property and dates.");
  }

  const rooms = property?.rooms || property?.room_types || [];
  const requiredBedGroupId = input.bedGroupId ? String(input.bedGroupId).trim() : "";
  for (const room of rooms) {
    const rates = room?.rates || [];
    for (const rate of rates) {
      const rateToken = String(
        rate?.id || rate?.bed_groups?.[0]?.links?.book?.href || room?.id || "",
      ).trim();
      // Server authority: package token must match exactly. Never match on bedGroup alone.
      if (!rateToken || rateToken !== bookToken) continue;
      const bedGroupId = rate?.bed_groups?.[0]?.id ? String(rate.bed_groups[0].id) : null;
      if (requiredBedGroupId && bedGroupId && bedGroupId !== requiredBedGroupId) {
        continue;
      }
      const money = extractRateMoney(rate);
      if (money.totalCents == null || money.totalCents <= 0) {
        throw new Error("Expedia Rapid returned a room package without a live total.");
      }
      return {
        totalRateCents: money.totalCents,
        taxAmountCents: money.taxCents,
        currency: "USD",
        bookToken: rateToken,
        bedGroupId: bedGroupId || (requiredBedGroupId || null),
        propertyId,
        raw: (rate && typeof rate === "object" ? rate : { rate }) as Record<string, unknown>,
      };
    }
  }

  throw new Error(
    "That hotel rate is no longer available from Expedia Rapid. Re-search and select a current package.",
  );
}

/**
 * Server-authoritative car reprice before Stripe PaymentIntent creation.
 * Re-fetches Rapid cars availability and matches the live offer token.
 * Local sandbox: USE_MOCK_TRAVEL=true (non-production) bypasses Rapid and returns a demo frame.
 */
export async function priceCheckExpediaCar(input: {
  bookToken: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupAt: string;
  dropoffAt: string;
}): Promise<ExpediaLivePrice> {
  if (String(process.env.USE_MOCK_TRAVEL || "").trim() === "true") {
    assertTravelDemoModeAllowed();
    const requestedBookToken = String(input.bookToken || "").trim();
    console.warn("[travel.demo] priceCheckExpediaCar — USE_MOCK_TRAVEL interceptor (sandbox vault).");
    return {
      totalRateCents: TRAVEL_DEMO_CAR_TOTAL_CENTS,
      totalAmountCents: TRAVEL_DEMO_CAR_TOTAL_CENTS,
      taxAmountCents: 0,
      currency: "USD",
      bookToken: TRAVEL_DEMO_CAR_BOOK_TOKEN,
      bedGroupId: null,
      propertyId: null,
      raw: {
        demo: true,
        pricedBy: "USE_MOCK_TRAVEL",
        totalAmountCents: TRAVEL_DEMO_CAR_TOTAL_CENTS,
        bookToken: TRAVEL_DEMO_CAR_BOOK_TOKEN,
        requestedBookToken,
        provider: "expedia",
      },
    };
  }

  const bookToken = String(input.bookToken || "").trim();
  if (!bookToken) throw new Error("Expedia car price check requires bookToken.");
  if (!input.pickupAt || !input.dropoffAt || input.dropoffAt <= input.pickupAt) {
    throw new Error("Expedia car price check requires valid pick-up and drop-off datetimes.");
  }

  const body = await rapidGet("/v3/cars/availability", {
    language: "en-US",
    currency: "USD",
    pickup_date: input.pickupAt.slice(0, 10),
    pickup_time: input.pickupAt.slice(11, 16) || "10:00",
    dropoff_date: input.dropoffAt.slice(0, 10),
    dropoff_time: input.dropoffAt.slice(11, 16) || "10:00",
    pickup_search: input.pickupLocation || "STL",
    dropoff_search: input.dropoffLocation || input.pickupLocation || "STL",
    "billing-terms": "AGREED",
    "partner-point-of-sale": process.env.EXPEDIA_RAPID_PARTNER_POS?.trim() || "browser",
    "payment-terms": "AGREED",
  });

  const rows = Array.isArray(body) ? body : body?.data || body?.cars || [];
  const match = rows.find((row: any) => {
    const token = String(row?.id || row?.offer_id || row?.rate?.id || "");
    return token === bookToken;
  });
  if (!match) {
    throw new Error(
      "That rental-car rate is no longer available from Expedia Rapid. Re-search and select a current offer.",
    );
  }

  const totalCents = moneyToCents(match?.price?.total || match?.rates?.[0]?.total || match?.total_price);
  if (totalCents == null || totalCents <= 0) {
    throw new Error("Expedia Rapid returned a car offer without a live total.");
  }
  return {
    totalRateCents: totalCents,
    taxAmountCents: moneyToCents(match?.price?.taxes || match?.rates?.[0]?.taxes || null) ?? 0,
    currency: String(match?.price?.currency || "USD").toUpperCase(),
    bookToken,
    bedGroupId: null,
    propertyId: null,
    raw: (match && typeof match === "object" ? match : { match }) as Record<string, unknown>,
  };
}

export async function bookExpediaHotel(input: {
  propertyId: string;
  bookToken: string;
  bedGroupId?: string | null;
  checkIn: string;
  checkOut: string;
  affiliateReferenceId: string;
  guest: ExpediaBookGuest;
  adults?: number;
}): Promise<ExpediaBookResult> {
  const phoneDigits = String(input.guest.phone || "").replace(/\D/g, "") || "7138242079";
  const payload = {
    affiliate_reference_id: input.affiliateReferenceId.slice(0, 28),
    hold: false,
    email: input.guest.email,
    phone: {
      country_code: "1",
      area_code: phoneDigits.slice(0, 3) || "713",
      number: phoneDigits.slice(3) || "8242079",
    },
    rooms: [
      {
        id: input.bookToken,
        bed_group_id: input.bedGroupId || undefined,
        given_name: input.guest.givenName,
        family_name: input.guest.familyName,
      },
    ],
    payments: [
      {
        type: "affiliate_collect",
        billing_contact: {
          given_name: input.guest.givenName,
          family_name: input.guest.familyName,
          email: input.guest.email,
        },
      },
    ],
  };

  const body = await rapidPost("/v3/itineraries", payload, {
    language: "en-US",
    checkin: input.checkIn,
    checkout: input.checkOut,
    currency: "USD",
    country_code: "US",
    occupancy: String(input.adults && input.adults > 0 ? input.adults : 2),
    property_id: input.propertyId,
    "billing-terms": "AGREED",
    "partner-point-of-sale": process.env.EXPEDIA_RAPID_PARTNER_POS?.trim() || "browser",
    "payment-terms": "AGREED",
  });

  const confirmationNumber = extractExpediaConfirmation(body);
  if (!confirmationNumber) {
    throw new Error("Expedia Rapid booked without a supplier confirmation number.");
  }
  return { confirmationNumber, raw: (body && typeof body === "object" ? body : { body }) as Record<string, unknown> };
}

/** Live itinerary retrieve for operator sync / webhook reconciliation. */
export async function retrieveExpediaItinerary(input: {
  itineraryId: string;
  email?: string | null;
}): Promise<{
  confirmationNumber: string;
  status: string | null;
  canceled: boolean;
  checkIn: string | null;
  checkOut: string | null;
  roomName: string | null;
  raw: Record<string, unknown>;
}> {
  const itineraryId = String(input.itineraryId || "").trim();
  if (!itineraryId) throw new Error("Expedia itinerary id is required.");
  const query: Record<string, string> = {
    language: "en-US",
    "billing-terms": "AGREED",
    "partner-point-of-sale": process.env.EXPEDIA_RAPID_PARTNER_POS?.trim() || "browser",
    "payment-terms": "AGREED",
  };
  if (input.email?.trim()) query.email = input.email.trim();

  const body = await rapidGet(`/v3/itineraries/${encodeURIComponent(itineraryId)}`, query);
  const confirmationNumber = extractExpediaConfirmation(body) || itineraryId;
  const status = String(
    body?.rooms?.[0]?.status || body?.status || body?.data?.status || "",
  ).trim() || null;
  const canceled = /cancel/i.test(status || "") || Boolean(body?.canceled || body?.cancelled);
  return {
    confirmationNumber,
    status,
    canceled,
    checkIn: body?.rooms?.[0]?.checkin || body?.checkin || body?.check_in || null,
    checkOut: body?.rooms?.[0]?.checkout || body?.checkout || body?.check_out || null,
    roomName: body?.rooms?.[0]?.room_name || body?.rooms?.[0]?.name || null,
    raw: (body && typeof body === "object" ? body : { body }) as Record<string, unknown>,
  };
}

export async function bookExpediaCar(input: {
  bookToken: string;
  affiliateReferenceId: string;
  guest: ExpediaBookGuest;
  pickupAt: string;
  dropoffAt: string;
}): Promise<ExpediaBookResult> {
  const phoneDigits = String(input.guest.phone || "").replace(/\D/g, "") || "7138242079";
  const payload = {
    affiliate_reference_id: input.affiliateReferenceId.slice(0, 28),
    offer_id: input.bookToken,
    email: input.guest.email,
    phone: {
      country_code: "1",
      area_code: phoneDigits.slice(0, 3) || "713",
      number: phoneDigits.slice(3) || "8242079",
    },
    driver: {
      given_name: input.guest.givenName,
      family_name: input.guest.familyName,
    },
    payments: [
      {
        type: "affiliate_collect",
        billing_contact: {
          given_name: input.guest.givenName,
          family_name: input.guest.familyName,
          email: input.guest.email,
        },
      },
    ],
    pickup_datetime: input.pickupAt,
    dropoff_datetime: input.dropoffAt,
  };

  const body = await rapidPost("/v3/cars/book", payload, {
    language: "en-US",
    currency: "USD",
    "billing-terms": "AGREED",
    "partner-point-of-sale": process.env.EXPEDIA_RAPID_PARTNER_POS?.trim() || "browser",
    "payment-terms": "AGREED",
  });

  const confirmationNumber = extractExpediaConfirmation(body);
  if (!confirmationNumber) {
    throw new Error("Expedia Rapid car booking returned no confirmation number.");
  }
  return { confirmationNumber, raw: (body && typeof body === "object" ? body : { body }) as Record<string, unknown> };
}
