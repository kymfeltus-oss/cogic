export type TravelCheckoutKind = "hotel" | "flight" | "car";

export type StashedTravelOffer = {
  kind: TravelCheckoutKind;
  offer: Record<string, unknown>;
  checkIn?: string | null;
  checkOut?: string | null;
  pickupAt?: string | null;
  dropoffAt?: string | null;
  stashedAt: string;
};

const PREFIX = "cogic.travel.checkout.offer:";

export function travelOfferStorageKey(offerId: string) {
  return `${PREFIX}${encodeURIComponent(offerId)}`;
}

export function stashTravelCheckoutOffer(offerId: string, payload: StashedTravelOffer) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    travelOfferStorageKey(offerId),
    JSON.stringify({
      ...payload,
      stashedAt: payload.stashedAt || new Date().toISOString(),
    }),
  );
}

export function readTravelCheckoutOffer(offerId: string): StashedTravelOffer | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(travelOfferStorageKey(offerId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StashedTravelOffer;
    if (!parsed?.offer || !parsed.kind) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearTravelCheckoutOffer(offerId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(travelOfferStorageKey(offerId));
}

export function formatTravelMoney(cents: number | null | undefined, currency = "USD") {
  if (cents == null || !Number.isFinite(cents)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}
