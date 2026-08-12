import "server-only";

import { fetchAmadeusAccessToken } from "@/lib/travel/corporate/amadeus-token-cache";
import {
  AMADEUS_CONNECTION_FAULT,
  type AmadeusCorporateGroupSearchPayload,
  type AmadeusConnectionFault,
  loadAmadeusCorporateCredentials,
  mapGroupRequestToAmadeusPayload,
} from "@/lib/travel/corporate/supplier-mapping";
import type { TravelGroupBookingRequestRow } from "@/lib/travel/group-booking/repository";

export type AmadeusGroupFlightSearchResult = {
  provider: "amadeus";
  mode: "flight";
  requestId: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  adults: number;
  offerCount: number;
  /** Raw Amadeus shopping response meta — no invented fares. */
  meta: Record<string, unknown>;
};

export type ExecuteAmadeusGroupSearchResult =
  | { ok: true; mapped: AmadeusCorporateGroupSearchPayload; flights: AmadeusGroupFlightSearchResult | null }
  | AmadeusConnectionFault
  | { ok: false; code: "MAPPING_ERROR"; message: string; status: number };

/**
 * Execute live Amadeus flight-offers search for a corporate group request row.
 * Fail-closed when credentials missing or IATA mapping invalid.
 */
export async function executeAmadeusCorporateGroupSearch(
  request: TravelGroupBookingRequestRow,
): Promise<ExecuteAmadeusGroupSearchResult> {
  let mapped;
  try {
    mapped = mapGroupRequestToAmadeusPayload(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Group request mapping failed.";
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status?: number }).status) || 400
        : 400;
    return { ok: false, code: "MAPPING_ERROR", message, status };
  }

  if (mapped.ok === false) {
    return mapped;
  }

  if (!mapped.payload.searchModes.includes("flight")) {
    return {
      ok: true,
      mapped: mapped.payload,
      flights: null,
    };
  }

  const origin = mapped.payload.originLocationCodes[0];
  const destination = mapped.payload.destinationLocationCodes[0];
  if (!origin || !destination) {
    return {
      ok: false,
      code: "MAPPING_ERROR",
      message: "Flight search requires origin and destination IATA codes.",
      status: 400,
    };
  }

  const credentials = mapped.credentials;
  const token = await fetchAmadeusAccessToken(credentials);

  const url = new URL(`${credentials.baseUrl}/v2/shopping/flight-offers`);
  url.searchParams.set("originLocationCode", origin);
  url.searchParams.set("destinationLocationCode", destination);
  url.searchParams.set("departureDate", mapped.payload.departureDate);
  url.searchParams.set("returnDate", mapped.payload.returnDate);
  url.searchParams.set("adults", String(Math.min(mapped.payload.adults, 9)));
  url.searchParams.set("currencyCode", mapped.payload.currencyCode);
  url.searchParams.set("max", "25");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as {
    data?: unknown[];
    meta?: Record<string, unknown>;
    errors?: Array<{ detail?: string }>;
  } | null;

  if (!response.ok) {
    const detail = body?.errors?.[0]?.detail || `Amadeus flight search failed (${response.status}).`;
    return {
      ok: false,
      faultCode: AMADEUS_CONNECTION_FAULT,
      message: detail,
    };
  }

  const offers = Array.isArray(body?.data) ? body.data : [];

  return {
    ok: true,
    mapped: mapped.payload,
    flights: {
      provider: "amadeus",
      mode: "flight",
      requestId: mapped.payload.requestId,
      origin,
      destination,
      departureDate: mapped.payload.departureDate,
      returnDate: mapped.payload.returnDate,
      adults: mapped.payload.adults,
      offerCount: offers.length,
      meta: {
        count: offers.length,
        amadeus: body?.meta ?? null,
      },
    },
  };
}
