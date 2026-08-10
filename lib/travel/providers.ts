import "server-only";
import type { ProviderStatus, TravelSearchKind } from "./types";
import {
  marketplaceCarProvider,
  marketplaceFlightProvider,
  marketplaceHotelProvider,
  marketplaceStatus,
  marketplaceUnavailableReason,
} from "./marketplace/credentials";

export {
  marketplaceStatus,
  marketplaceUnavailableReason,
  marketplaceHotelProvider,
  marketplaceFlightProvider,
  marketplaceCarProvider,
};

export function providerStatuses(): ProviderStatus[] {
  return marketplaceStatus().providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    configured: provider.configured,
  }));
}

export function providerAvailable(kind: TravelSearchKind) {
  if (kind === "hotels") return Boolean(marketplaceHotelProvider());
  if (kind === "flights") return Boolean(marketplaceFlightProvider());
  return Boolean(marketplaceCarProvider());
}

export function unavailableMessage(kind: TravelSearchKind) {
  return marketplaceUnavailableReason(kind);
}
