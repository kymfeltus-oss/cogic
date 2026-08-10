export type MarketplaceKind = "hotels" | "flights" | "cars";

export type MarketplaceSearchCode =
  | "results"
  | "zero_results"
  | "provider_not_configured"
  | "provider_unavailable"
  | "validation_error";

export type MarketplaceHotelOffer = {
  id: string;
  provider: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  starRating: number | null;
  nightlyRateCents: number | null;
  totalRateCents: number | null;
  currency: string;
  roomName: string | null;
  cancelPolicy: string | null;
  bookingUrl: string | null;
  imageUrl: string | null;
};

export type MarketplaceFlightOffer = {
  id: string;
  provider: string;
  airline: string | null;
  flightNumber: string | null;
  origin: string;
  destination: string;
  departAt: string | null;
  arriveAt: string | null;
  cabin: string | null;
  stops: number;
  totalFareCents: number | null;
  currency: string;
  bookingUrl: string | null;
};

export type MarketplaceCarOffer = {
  id: string;
  provider: string;
  company: string | null;
  vehicleName: string | null;
  vehicleClass: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  pickupAt: string | null;
  dropoffAt: string | null;
  totalRateCents: number | null;
  currency: string;
  bookingUrl: string | null;
};

export type MarketplaceSearchResponse<T> = {
  available: boolean;
  code: MarketplaceSearchCode;
  provider: string | null;
  reason?: string;
  offers: T[];
};
