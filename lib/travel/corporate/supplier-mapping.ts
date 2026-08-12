import "server-only";

import type { TravelGroupBookingRequestRow } from "@/lib/travel/group-booking/repository";
import {
  TRAVEL_GROUP_MIN_PARTY_SIZE,
  type TravelGroupTravelType,
} from "@/lib/travel/group-booking/validation";

/** Explicit connection fault when Amadeus enterprise credentials are missing. */
export const AMADEUS_CONNECTION_FAULT = "AMADEUS_CONNECTION_FAULT" as const;
export type AmadeusConnectionFaultCode = typeof AMADEUS_CONNECTION_FAULT;

export class CorporateGroupMappingError extends Error {
  readonly code = "CORPORATE_GROUP_MAPPING_ERROR" as const;
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CorporateGroupMappingError";
    this.status = status;
  }
}

export type AmadeusCorporateGroupSearchPayload = {
  source: "travel_group_booking_requests";
  requestId: string;
  churchId: string;
  programKey: string;
  travelType: TravelGroupTravelType;
  partySize: number;
  departureDate: string;
  returnDate: string;
  /** IATA origin terminal codes (empty for hotel/car city-only searches). */
  originLocationCodes: string[];
  /** IATA destination terminal / city codes. */
  destinationLocationCodes: string[];
  currencyCode: "USD";
  /** Amadeus flight-offers style traveler count (capped display; partySize is authoritative). */
  adults: number;
  searchModes: Array<"flight" | "hotel" | "car">;
};

export type AmadeusCorporateCredentials = {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
};

export type AmadeusConnectionFault = {
  ok: false;
  faultCode: AmadeusConnectionFaultCode;
  message: string;
};

export type MapGroupRequestToAmadeusResult =
  | {
      ok: true;
      payload: AmadeusCorporateGroupSearchPayload;
      credentials: AmadeusCorporateCredentials;
    }
  | AmadeusConnectionFault;

const IATA_TOKEN = /^[A-Z]{3}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Load Amadeus enterprise credentials from the server environment only.
 * Primary: AMADEUS_API_KEY + AMADEUS_API_SECRET (repo standard).
 * Alias: AMADEUS_CLIENT_ID + AMADEUS_CLIENT_SECRET.
 */
export function loadAmadeusCorporateCredentials():
  | { ok: true; credentials: AmadeusCorporateCredentials }
  | AmadeusConnectionFault {
  const clientId =
    process.env.AMADEUS_API_KEY?.trim() ||
    process.env.AMADEUS_CLIENT_ID?.trim() ||
    "";
  const clientSecret =
    process.env.AMADEUS_API_SECRET?.trim() ||
    process.env.AMADEUS_CLIENT_SECRET?.trim() ||
    "";
  const baseUrl = (
    process.env.AMADEUS_BASE_URL?.trim() || "https://api.amadeus.com"
  ).replace(/\/$/, "");

  if (!clientId || !clientSecret) {
    return {
      ok: false,
      faultCode: AMADEUS_CONNECTION_FAULT,
      message:
        "Amadeus enterprise credentials are not configured (AMADEUS_API_KEY/AMADEUS_API_SECRET or AMADEUS_CLIENT_ID/AMADEUS_CLIENT_SECRET).",
    };
  }

  return {
    ok: true,
    credentials: { clientId, clientSecret, baseUrl },
  };
}

/**
 * Extract explicit IATA terminal tokens from free-text fields.
 * Never invents airport codes from city names (Live Mode).
 */
export function extractIataTerminalCodes(...fields: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const codes: string[] = [];

  for (const field of fields) {
    if (!field) continue;
    const upper = field.trim().toUpperCase();
    if (!upper) continue;

    for (const part of upper.split(/[^A-Z]+/)) {
      if (!IATA_TOKEN.test(part) || seen.has(part)) continue;
      seen.add(part);
      codes.push(part);
    }
  }

  return codes;
}

function searchModesForTravelType(
  travelType: TravelGroupTravelType,
): Array<"flight" | "hotel" | "car"> {
  switch (travelType) {
    case "flight":
      return ["flight"];
    case "hotel":
      return ["hotel"];
    case "car":
      return ["car"];
    case "multi":
      return ["flight", "hotel", "car"];
  }
}

function assertCorporatePartySize(partySize: number): void {
  if (!Number.isInteger(partySize) || partySize < TRAVEL_GROUP_MIN_PARTY_SIZE) {
    throw new CorporateGroupMappingError(
      `Corporate group Amadeus mapping requires party_size >= ${TRAVEL_GROUP_MIN_PARTY_SIZE}. Retail traffic must not enter this queue.`,
      400,
    );
  }
}

function resolveTerminalArrays(input: {
  travelType: TravelGroupTravelType;
  destination: string;
  internalNotes: string | null;
}): { originLocationCodes: string[]; destinationLocationCodes: string[] } {
  const codes = extractIataTerminalCodes(input.destination, input.internalNotes);

  if (codes.length === 0) {
    throw new CorporateGroupMappingError(
      "Destination must include explicit IATA terminal codes (e.g. MEM-STL). City names alone are not mapped.",
      400,
    );
  }

  const needsFlightOrigin =
    input.travelType === "flight" || input.travelType === "multi";

  if (needsFlightOrigin) {
    if (codes.length < 2) {
      throw new CorporateGroupMappingError(
        "Flight/multi group requests require origin and destination IATA codes (e.g. MEM-STL).",
        400,
      );
    }
    return {
      originLocationCodes: [codes[0]!],
      destinationLocationCodes: [codes[codes.length - 1]!],
    };
  }

  // Hotel/car: single city/terminal IATA is sufficient; optional origin ignored.
  if (codes.length >= 2) {
    return {
      originLocationCodes: [codes[0]!],
      destinationLocationCodes: [codes[codes.length - 1]!],
    };
  }

  return {
    originLocationCodes: [],
    destinationLocationCodes: [codes[0]!],
  };
}

/**
 * Map a verified travel_group_booking_requests row into an Amadeus corporate
 * group search payload. Enforces party_size >= 10 and fail-closed credentials.
 */
export function mapGroupRequestToAmadeusPayload(
  request: TravelGroupBookingRequestRow,
): MapGroupRequestToAmadeusResult {
  assertCorporatePartySize(request.party_size);

  if (!ISO_DATE.test(String(request.departure_date || "").trim())) {
    throw new CorporateGroupMappingError("departure_date must be YYYY-MM-DD.", 400);
  }
  if (!ISO_DATE.test(String(request.return_date || "").trim())) {
    throw new CorporateGroupMappingError("return_date must be YYYY-MM-DD.", 400);
  }
  if (String(request.return_date) < String(request.departure_date)) {
    throw new CorporateGroupMappingError(
      "return_date must be on or after departure_date.",
      400,
    );
  }

  const credentialLoad = loadAmadeusCorporateCredentials();
  if (credentialLoad.ok === false) {
    return {
      ok: false,
      faultCode: credentialLoad.faultCode,
      message: credentialLoad.message,
    };
  }

  const terminals = resolveTerminalArrays({
    travelType: request.travel_type,
    destination: request.destination,
    internalNotes: request.internal_notes,
  });

  const payload: AmadeusCorporateGroupSearchPayload = {
    source: "travel_group_booking_requests",
    requestId: request.id,
    churchId: request.church_id,
    programKey: request.program_key,
    travelType: request.travel_type,
    partySize: request.party_size,
    departureDate: request.departure_date,
    returnDate: request.return_date,
    originLocationCodes: terminals.originLocationCodes,
    destinationLocationCodes: terminals.destinationLocationCodes,
    currencyCode: "USD",
    adults: request.party_size,
    searchModes: searchModesForTravelType(request.travel_type),
  };

  return {
    ok: true,
    payload,
    credentials: credentialLoad.credentials,
  };
}
