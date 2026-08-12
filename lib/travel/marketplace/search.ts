import "server-only";
import {
  marketplaceCarProvider,
  marketplaceFlightProvider,
  marketplaceHotelProvider,
  marketplaceProviderUnavailableReason,
  marketplaceUnavailableReason,
  recordProviderEvent,
} from "./credentials";
import { searchDuffelFlights } from "./duffel";
import { searchExpediaCars, searchExpediaHotels } from "./expedia-rapid";
import {
  parseMapBounds,
  pointInBounds,
  type MapBounds,
} from "@/lib/travel/map-bounds";
import type {
  MarketplaceCarOffer,
  MarketplaceFlightOffer,
  MarketplaceHotelOffer,
  MarketplaceSearchResponse,
} from "./types";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const IATA = /^[A-Za-z]{3}$/;

export class MarketplaceValidationError extends Error {
  code = "validation_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "MarketplaceValidationError";
  }
}

function requireDate(value: string, label: string) {
  if (!DATE.test(value)) throw new MarketplaceValidationError(`${label} must be YYYY-MM-DD.`);
  return value;
}

async function runProviderSearch<T>(
  provider: string,
  kind: "hotels" | "flights" | "cars",
  fn: () => Promise<T[]>,
): Promise<MarketplaceSearchResponse<T>> {
  try {
    const offers = await fn();
    recordProviderEvent(provider, true, `${kind} search ok (${offers.length})`);
    if (!offers.length) {
      return {
        available: true,
        code: "zero_results",
        provider,
        reason: `No live ${kind.slice(0, -1)} offers matched that search.`,
        offers: [],
      };
    }
    return { available: true, code: "results", provider, offers };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider request failed.";
    recordProviderEvent(provider, false, message);
    return {
      available: false,
      code: "provider_unavailable",
      provider,
      reason: marketplaceProviderUnavailableReason(kind),
      offers: [],
    };
  }
}

function filterHotelOffersByBounds(
  offers: MarketplaceHotelOffer[],
  bounds: MapBounds | null,
): MarketplaceHotelOffer[] {
  if (!bounds) return offers;
  return offers
    .filter(
      (offer) =>
        offer.latitude != null &&
        offer.longitude != null &&
        pointInBounds(
          { latitude: offer.latitude, longitude: offer.longitude },
          bounds,
        ),
    )
    .sort((a, b) => {
      const aRate = a.nightlyRateCents ?? a.totalRateCents ?? Number.MAX_SAFE_INTEGER;
      const bRate = b.nightlyRateCents ?? b.totalRateCents ?? Number.MAX_SAFE_INTEGER;
      return aRate - bRate;
    });
}

export async function searchMarketplaceHotels(input: {
  destination: string;
  checkIn: string;
  checkOut: string;
  adults?: number;
  /** Optional Leaflet viewport; filters offers that include real provider coordinates. */
  bounds?: unknown;
}): Promise<MarketplaceSearchResponse<MarketplaceHotelOffer> & { bounds: MapBounds | null }> {
  const destination = input.destination.trim();
  if (destination.length < 2) throw new MarketplaceValidationError("Enter a US city or airport destination.");
  const checkIn = requireDate(input.checkIn, "Check-in");
  const checkOut = requireDate(input.checkOut, "Check-out");
  if (checkOut <= checkIn) throw new MarketplaceValidationError("Check-out must be after check-in.");
  const bounds = parseMapBounds(input.bounds ?? null);

  const provider = marketplaceHotelProvider();
  if (!provider) {
    return {
      available: false,
      code: "provider_not_configured",
      provider: null,
      reason: marketplaceUnavailableReason("hotels"),
      offers: [],
      bounds,
    };
  }

  // Fulfillment-capable providers only (Expedia Rapid). Amadeus search is not a checkout path.
  const result = await runProviderSearch(provider, "hotels", () =>
    searchExpediaHotels({ destination, checkIn, checkOut, adults: input.adults }),
  );

  if (result.code !== "results") {
    return { ...result, bounds };
  }

  const filtered = filterHotelOffersByBounds(result.offers, bounds);
  if (!filtered.length) {
    return {
      available: true,
      code: "zero_results",
      provider: result.provider,
      reason: bounds
        ? "No live marketplace hotels with coordinates fall inside the current map viewport."
        : result.reason || "No live hotel offers matched that search.",
      offers: [],
      bounds,
    };
  }

  return { ...result, offers: filtered, bounds };
}

export async function searchMarketplaceFlights(input: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string | null;
  adults?: number;
  cabin?: string;
}): Promise<MarketplaceSearchResponse<MarketplaceFlightOffer>> {
  const origin = input.origin.trim().toUpperCase();
  const destination = input.destination.trim().toUpperCase();
  if (!IATA.test(origin) || !IATA.test(destination)) {
    throw new MarketplaceValidationError(
      "Origin and destination must be 3-letter airport codes (for example STL, ATL, LAX).",
    );
  }
  const departDate = requireDate(input.departDate, "Depart date");
  const returnDate = input.returnDate ? requireDate(input.returnDate, "Return date") : null;
  if (returnDate && returnDate < departDate) {
    throw new MarketplaceValidationError("Return date must be on or after depart date.");
  }

  const provider = marketplaceFlightProvider();
  if (!provider) {
    return {
      available: false,
      code: "provider_not_configured",
      provider: null,
      reason: marketplaceUnavailableReason("flights"),
      offers: [],
    };
  }

  // Fulfillment-capable providers only (Duffel). Amadeus search is not a checkout path.
  return runProviderSearch(provider, "flights", () =>
    searchDuffelFlights({
      origin,
      destination,
      departDate,
      returnDate,
      adults: input.adults,
      cabin: input.cabin,
    }),
  );
}

export async function searchMarketplaceCars(input: {
  pickupLocation: string;
  dropoffLocation?: string;
  pickupDate: string;
  pickupTime: string;
  dropoffDate: string;
  dropoffTime: string;
}): Promise<MarketplaceSearchResponse<MarketplaceCarOffer>> {
  const pickupLocation = input.pickupLocation.trim();
  if (pickupLocation.length < 2) {
    throw new MarketplaceValidationError("Enter a US pick-up city or airport.");
  }
  const pickupDate = requireDate(input.pickupDate, "Pick-up date");
  const dropoffDate = requireDate(input.dropoffDate, "Drop-off date");
  const pickupAt = `${pickupDate}T${input.pickupTime || "10:00"}`;
  const dropoffAt = `${dropoffDate}T${input.dropoffTime || "10:00"}`;
  if (dropoffAt <= pickupAt) throw new MarketplaceValidationError("Drop-off must be after pick-up.");

  const provider = marketplaceCarProvider();
  if (!provider) {
    return {
      available: false,
      code: "provider_not_configured",
      provider: null,
      reason: marketplaceUnavailableReason("cars"),
      offers: [],
    };
  }

  // Fulfillment-capable providers only (Expedia Rapid). Amadeus search is not a checkout path.
  return runProviderSearch(provider, "cars", () =>
    searchExpediaCars({
      pickupLocation,
      dropoffLocation: input.dropoffLocation?.trim() || pickupLocation,
      pickupAt,
      dropoffAt,
    }),
  );
}
