import type { TravelHotel } from "./types";

/** Static hotel photos in /public/hotels — keyed by travel_hotels.slug */
export const HOTEL_IMAGE_BY_SLUG: Record<string, string> = {
  "hotel-saint-louis": "/hotels/Hotel-Saint-Louis-Autograph-Collection.jpg",
  "hampton-inn-gateway-arch": "/hotels/Hampton-Inn-St-Louis-Downtown---Exterior.jpg",
  "21c-museum-hotel": "/hotels/Museum-Hotel-St-Louis.jpg",
  "hilton-st-louis-ballpark": "/hotels/Hilton-St-Louis-Ballpark.jpg",
  "hilton-pennywell-st-louis": "/hotels/Hilton-Pennywell-Hotel.jpg",
  "bishops-hyatt-regency": "/hotels/Hyat-Regency-Saint-Louis-at-The-Arch.jpg",
};

export function resolveHotelImage(hotel: Pick<TravelHotel, "slug" | "image_url">): string | null {
  if (hotel.image_url) return hotel.image_url;
  if (hotel.slug && HOTEL_IMAGE_BY_SLUG[hotel.slug]) return HOTEL_IMAGE_BY_SLUG[hotel.slug];
  return null;
}
