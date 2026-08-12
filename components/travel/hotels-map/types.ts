export type HotelMapPinSource = "official" | "marketplace";

export type HotelMapPin = {
  id: string;
  source: HotelMapPinSource;
  slug: string | null;
  name: string;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  mapUrl: string | null;
  negotiatedRateCents: number | null;
  nightlyRateCents: number | null;
  totalRateCents: number | null;
  currency: string;
  starRating: number | null;
  pricingTiers: Array<{ id: string; name: string; nightlyRateCents: number }>;
  ratingMarks: string[];
  /** Official inventory profile path at /travel/hotels/[id]. */
  profileHref: string | null;
  marketplaceOffer?: Record<string, unknown> | null;
};

export type HotelMapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
  northEast: { lat: number; lng: number };
  southWest: { lat: number; lng: number };
};
