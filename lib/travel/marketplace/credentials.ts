import "server-only";

export type MarketplaceProviderId = "expedia-rapid" | "duffel" | "amadeus";
export type ProviderConnectionState = "connected" | "not_configured" | "unavailable";

type ProviderEvent = {
  at: string;
  ok: boolean;
  message: string;
};

const lastProviderEvents = new Map<string, ProviderEvent>();

/**
 * Sandbox gate for marketplace price-check / offer-retrieve stubs.
 * Enabled when USE_MOCK_TRAVEL=true in .env.local or a non-production cloud vault.
 * Hard-disabled when VERCEL_ENV=production — never invent rates on the live production host.
 * Note: Vercel Preview sets NODE_ENV=production; that alone must not block sandbox.
 */
export function travelDemoModeEnabled() {
  if (String(process.env.USE_MOCK_TRAVEL || "").trim() !== "true") {
    return false;
  }
  if (process.env.VERCEL_ENV === "production") {
    return false;
  }
  return true;
}

export function expediaRapidConfigured() {
  if (travelDemoModeEnabled()) return true;
  return Boolean(process.env.EXPEDIA_RAPID_API_KEY?.trim() && process.env.EXPEDIA_RAPID_API_SECRET?.trim());
}

export function duffelConfigured() {
  if (travelDemoModeEnabled()) return true;
  return Boolean(process.env.DUFFEL_ACCESS_TOKEN?.trim());
}

/** Enterprise Amadeus only — self-service portal was decommissioned July 2026. */
export function amadeusConfigured() {
  return Boolean(process.env.AMADEUS_API_KEY?.trim() && process.env.AMADEUS_API_SECRET?.trim());
}

/**
 * Marketplace search only surfaces fulfillment-capable providers.
 * Hotels/cars → Expedia Rapid. Flights → Duffel.
 * Enterprise Amadeus may appear in diagnostics but is not a checkout path.
 */
export function marketplaceHotelProvider(): MarketplaceProviderId | null {
  if (expediaRapidConfigured()) return "expedia-rapid";
  return null;
}

export function marketplaceFlightProvider(): MarketplaceProviderId | null {
  if (duffelConfigured()) return "duffel";
  return null;
}

export function marketplaceCarProvider(): MarketplaceProviderId | null {
  if (expediaRapidConfigured()) return "expedia-rapid";
  return null;
}

export function recordProviderEvent(providerId: string, ok: boolean, message: string) {
  lastProviderEvents.set(providerId, {
    at: new Date().toISOString(),
    ok,
    message: String(message || "").slice(0, 240),
  });
}

function safeEvent(providerId: string) {
  const event = lastProviderEvents.get(providerId);
  if (!event) return null;
  return {
    at: event.at,
    ok: event.ok,
    message: event.message
      .replace(/Bearer\s+\S+/gi, "[redacted]")
      .replace(/apikey[=:]\S+/gi, "[redacted]")
      .replace(/signature[=:]\S+/gi, "[redacted]"),
  };
}

function providerEntry(
  id: MarketplaceProviderId,
  name: string,
  kinds: readonly ("hotels" | "flights" | "cars")[],
  configured: boolean,
) {
  const last = safeEvent(id);
  const connection: ProviderConnectionState = !configured
    ? "not_configured"
    : last && !last.ok
      ? "unavailable"
      : "connected";
  return {
    id,
    name,
    kinds,
    configured,
    connection,
    lastCheckAt: last?.at ?? null,
    lastCheckOk: last ? last.ok : null,
    lastFailureMessage: last && !last.ok ? last.message : null,
  };
}

export function marketplaceStatus() {
  const expedia = providerEntry("expedia-rapid", "Expedia Rapid", ["hotels", "cars"], expediaRapidConfigured());
  const duffel = providerEntry("duffel", "Duffel", ["flights"], duffelConfigured());
  const amadeus = providerEntry(
    "amadeus",
    "Amadeus (Enterprise)",
    ["hotels", "flights", "cars"],
    amadeusConfigured(),
  );

  const hotelProvider = marketplaceHotelProvider();
  const flightProvider = marketplaceFlightProvider();
  const carProvider = marketplaceCarProvider();

  return {
    hotels: {
      configured: Boolean(hotelProvider),
      provider: hotelProvider,
      connection: hotelProvider
        ? ([expedia, amadeus].find((p) => p.id === hotelProvider)?.connection ?? "connected")
        : ("not_configured" as ProviderConnectionState),
      searchOperational: Boolean(hotelProvider),
    },
    flights: {
      configured: Boolean(flightProvider),
      provider: flightProvider,
      connection: flightProvider
        ? ([duffel, amadeus].find((p) => p.id === flightProvider)?.connection ?? "connected")
        : ("not_configured" as ProviderConnectionState),
      searchOperational: Boolean(flightProvider),
    },
    cars: {
      configured: Boolean(carProvider),
      provider: carProvider,
      connection: carProvider
        ? ([expedia, amadeus].find((p) => p.id === carProvider)?.connection ?? "connected")
        : ("not_configured" as ProviderConnectionState),
      searchOperational: Boolean(carProvider),
    },
    /** True when at least one fulfillment-capable search lane is configured for in-app checkout. */
    checkoutFulfillmentOperational: Boolean(hotelProvider || flightProvider || carProvider),
    providers: [expedia, duffel, amadeus],
  };
}

export function marketplaceUnavailableReason(kind: "hotels" | "flights" | "cars") {
  const labels = {
    hotels: "hotel",
    flights: "flight",
    cars: "rental car",
  } as const;
  const credentialHint =
    kind === "flights"
      ? "Configure DUFFEL_ACCESS_TOKEN for live flight checkout."
      : "Configure EXPEDIA_RAPID_API_KEY and EXPEDIA_RAPID_API_SECRET for live hotel/car checkout.";
  return `Live US ${labels[kind]} marketplace search is not connected. ${credentialHint} Official COGIC rates remain available separately. We never invent prices or availability.`;
}

export function marketplaceProviderUnavailableReason(kind: "hotels" | "flights" | "cars") {
  const labels = {
    hotels: "hotel",
    flights: "flight",
    cars: "rental car",
  } as const;
  return `The connected ${labels[kind]} marketplace provider is temporarily unavailable. No invented offers are shown. Try again later or use Official COGIC hotels where applicable.`;
}
