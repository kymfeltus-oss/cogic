export const TRAVEL_GROUP_MIN_PARTY_SIZE = 10;

export const TRAVEL_GROUP_TRAVEL_TYPES = ["hotel", "flight", "car", "multi"] as const;
export type TravelGroupTravelType = (typeof TRAVEL_GROUP_TRAVEL_TYPES)[number];

export const TRAVEL_GROUP_REQUEST_STATUSES = [
  "pending_quote",
  "quoted",
  "approved",
  "rejected",
  "canceled",
  "fulfilled",
] as const;
export type TravelGroupRequestStatus = (typeof TRAVEL_GROUP_REQUEST_STATUSES)[number];

export type SanitizedTravelGroupCreateFields = {
  partySize: number;
  travelType: TravelGroupTravelType;
  destination: string;
  departureDate: string;
  returnDate: string;
  internalNotes: string | null;
};

export type TravelGroupRequestValidationError = {
  status: 400;
  error: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isTravelType(value: string): value is TravelGroupTravelType {
  return (TRAVEL_GROUP_TRAVEL_TYPES as readonly string[]).includes(value);
}

/**
 * Sanitize client payload for create. Never accepts church_id, requester_id, or status.
 */
export function sanitizeTravelGroupRequestCreateInput(
  body: unknown,
): SanitizedTravelGroupCreateFields | TravelGroupRequestValidationError {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { status: 400, error: "Request body must be a JSON object." };
  }

  const source = body as Record<string, unknown>;

  if (
    "church_id" in source ||
    "churchId" in source ||
    "requester_id" in source ||
    "requesterId" in source ||
    "status" in source ||
    "user_id" in source ||
    "userId" in source
  ) {
    return {
      status: 400,
      error: "Client-supplied church, requester, user, or status fields are rejected.",
    };
  }

  const partySize = Number(source.party_size ?? source.partySize);
  if (!Number.isInteger(partySize) || partySize < TRAVEL_GROUP_MIN_PARTY_SIZE) {
    return {
      status: 400,
      error: `Party size must be an integer of at least ${TRAVEL_GROUP_MIN_PARTY_SIZE}.`,
    };
  }

  const travelTypeRaw = String(source.travel_type ?? source.travelType ?? "")
    .trim()
    .toLowerCase();
  if (!isTravelType(travelTypeRaw)) {
    return {
      status: 400,
      error: "travel_type must be one of: hotel, flight, car, multi.",
    };
  }

  const destination = String(source.destination ?? "").trim();
  if (destination.length < 2) {
    return { status: 400, error: "destination is required." };
  }

  const departureDate = String(source.departure_date ?? source.departureDate ?? "").trim();
  const returnDate = String(source.return_date ?? source.returnDate ?? "").trim();
  if (!ISO_DATE.test(departureDate) || !ISO_DATE.test(returnDate)) {
    return {
      status: 400,
      error: "departure_date and return_date must be ISO dates (YYYY-MM-DD).",
    };
  }
  if (returnDate < departureDate) {
    return { status: 400, error: "return_date must be on or after departure_date." };
  }

  const notesRaw = source.notes ?? source.internal_notes ?? source.internalNotes;
  const internalNotes =
    typeof notesRaw === "string" && notesRaw.trim()
      ? notesRaw.trim().slice(0, 2000)
      : null;

  return {
    partySize,
    travelType: travelTypeRaw,
    destination: destination.slice(0, 200),
    departureDate,
    returnDate,
    internalNotes,
  };
}

export function isTravelGroupRequestValidationError(
  value: SanitizedTravelGroupCreateFields | TravelGroupRequestValidationError,
): value is TravelGroupRequestValidationError {
  return "status" in value && value.status === 400;
}
