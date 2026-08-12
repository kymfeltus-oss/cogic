"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  CalendarDays,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  MapPin,
  Search,
  Star,
} from "lucide-react";
import MarketplaceOfferActions from "@/components/travel/MarketplaceOfferActions";
import MarketplaceSearchOutcome from "@/components/travel/MarketplaceSearchOutcome";
import type { HotelMapBounds, HotelMapPin } from "@/components/travel/hotels-map/types";
import { hotelAvailabilityRank } from "@/lib/travel/hotel-availability";
import { resolveHotelImage } from "@/lib/travel/hotel-images";
import type { MarketplaceHotelOffer, MarketplaceSearchCode } from "@/lib/travel/marketplace/types";
import type { TravelHotel } from "@/lib/travel/types";

function MapGridSkeleton({ label }: { label: string }) {
  return (
    <div className="ct-hotel-map ct-hotel-map--loading" aria-busy="true" aria-live="polite">
      <div className="ct-hotel-map__boot-skel" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <p>{label}</p>
    </div>
  );
}

const HotelsInventoryMap = dynamic(
  () => import("@/components/travel/hotels-map/HotelsInventoryMap"),
  {
    ssr: false,
    loading: () => <MapGridSkeleton label="LOADING map canvas and checking room allocations…" />,
  },
);

function toSearchBoundsPayload(bounds: HotelMapBounds) {
  return {
    north: bounds.north,
    south: bounds.south,
    east: bounds.east,
    west: bounds.west,
    northEast: bounds.northEast,
    southWest: bounds.southWest,
    bounds: {
      north: bounds.north,
      south: bounds.south,
      east: bounds.east,
      west: bounds.west,
      northEast: bounds.northEast,
      southWest: bounds.southWest,
    },
  };
}

const money = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value / 100);

function officialPin(hotel: TravelHotel, checkIn: string, checkOut: string): HotelMapPin | null {
  if (hotel.latitude == null || hotel.longitude == null) return null;
  const pricingTiers = (hotel.travel_hotel_room_types ?? [])
    .slice()
    .sort((a, b) => a.nightly_rate_cents - b.nightly_rate_cents)
    .map((room) => ({
      id: room.id,
      name: room.name,
      nightlyRateCents: room.nightly_rate_cents,
    }));
  const ratingMarks: string[] = [];
  if (hotel.cogic_designation === "BISHOPS") ratingMarks.push("Bishops Hotel");
  else ratingMarks.push("Official COGIC Housing");
  if (hotel.minimum_nights) ratingMarks.push(`${hotel.minimum_nights}-night minimum`);

  return {
    id: hotel.id,
    source: "official",
    slug: hotel.slug,
    name: hotel.name,
    latitude: hotel.latitude,
    longitude: hotel.longitude,
    imageUrl: resolveHotelImage(hotel),
    mapUrl: hotel.map_url,
    negotiatedRateCents: hotel.negotiated_rate_cents,
    nightlyRateCents: hotel.negotiated_rate_cents,
    totalRateCents: null,
    currency: hotel.rate_currency || "USD",
    starRating: null,
    pricingTiers,
    ratingMarks,
    profileHref: `/travel/hotels/${hotel.slug || hotel.id}?checkIn=${checkIn}&checkOut=${checkOut}`,
    marketplaceOffer: null,
  };
}

function marketplacePin(
  offer: MarketplaceHotelOffer,
  checkIn: string,
  checkOut: string,
): HotelMapPin | null {
  if (offer.latitude == null || offer.longitude == null) return null;
  const ratingMarks = ["Marketplace"];
  if (offer.roomName) ratingMarks.push(offer.roomName);
  return {
    id: offer.id,
    source: "marketplace",
    slug: null,
    name: offer.name,
    latitude: offer.latitude,
    longitude: offer.longitude,
    imageUrl: offer.imageUrl,
    mapUrl: null,
    negotiatedRateCents: null,
    nightlyRateCents: offer.nightlyRateCents,
    totalRateCents: offer.totalRateCents,
    currency: offer.currency || "USD",
    starRating: offer.starRating,
    pricingTiers:
      offer.roomName && (offer.nightlyRateCents != null || offer.totalRateCents != null)
        ? [
            {
              id: `${offer.id}-room`,
              name: offer.roomName,
              nightlyRateCents: offer.nightlyRateCents ?? offer.totalRateCents ?? 0,
            },
          ]
        : [],
    ratingMarks,
    profileHref: null,
    marketplaceOffer: {
      ...offer,
      checkIn,
      checkOut,
    },
  };
}

export default function HotelSearchClient({ hotels }: { hotels: TravelHotel[] }) {
  const [destination, setDestination] = useState("St. Louis, MO");
  const [checkIn, setCheckIn] = useState("2026-11-03");
  const [checkOut, setCheckOut] = useState("2026-11-09");
  const [adults, setAdults] = useState(2);
  const [searched, setSearched] = useState(false);
  const [marketplaceActive, setMarketplaceActive] = useState(false);

  const [visibleOfficialIds, setVisibleOfficialIds] = useState<string[] | null>(null);
  const [marketplaceOffers, setMarketplaceOffers] = useState<MarketplaceHotelOffer[] | null>(null);
  const [marketplaceCode, setMarketplaceCode] = useState<MarketplaceSearchCode | null>(null);
  const [marketplaceReason, setMarketplaceReason] = useState("");
  const [marketplaceProvider, setMarketplaceProvider] = useState<string | null>(null);
  const [marketplaceError, setMarketplaceError] = useState("");
  const [boundsError, setBoundsError] = useState<string | null>(null);
  const [tileError, setTileError] = useState<string | null>(null);
  const [viewportReady, setViewportReady] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const [marketplaceBusy, setMarketplaceBusy] = useState(false);

  const requestSeq = useRef(0);
  const marketplaceSeq = useRef(0);
  const lastBounds = useRef<HotelMapBounds | null>(null);
  const boundsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const officialPins = useMemo(
    () =>
      hotels
        .map((hotel) => officialPin(hotel, checkIn, checkOut))
        .filter((pin): pin is HotelMapPin => Boolean(pin)),
    [hotels, checkIn, checkOut],
  );

  const marketplacePins = useMemo(
    () =>
      (marketplaceOffers ?? [])
        .map((offer) => marketplacePin(offer, checkIn, checkOut))
        .filter((pin): pin is HotelMapPin => Boolean(pin)),
    [marketplaceOffers, checkIn, checkOut],
  );

  const mapPins = useMemo(() => [...officialPins, ...marketplacePins], [officialPins, marketplacePins]);

  const officialRows = useMemo(() => {
    const ranked = hotels
      .map((hotel) => ({
        ...hotel,
        rank: searched
          ? hotelAvailabilityRank(
              hotel.travel_hotel_room_types ?? [],
              checkIn,
              checkOut,
              hotel.minimum_nights,
            )
          : 0,
      }))
      .sort((first, second) => first.rank - second.rank);

    if (!visibleOfficialIds) return ranked;
    const order = new Map(visibleOfficialIds.map((id, index) => [id, index]));
    return ranked
      .filter((hotel) => order.has(hotel.id))
      .sort((first, second) => (order.get(first.id) ?? 0) - (order.get(second.id) ?? 0));
  }, [hotels, checkIn, checkOut, searched, visibleOfficialIds]);

  async function refreshOfficialBounds(bounds: HotelMapBounds) {
    const seq = ++requestSeq.current;
    startRefresh(async () => {
      setBoundsError(null);
      try {
        const response = await fetch("/api/travel/hotels/map", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...toSearchBoundsPayload(bounds),
            checkIn: searched ? checkIn : null,
            checkOut: searched ? checkOut : null,
          }),
        });
        if (!response.ok) throw new Error("Map bounds refresh failed.");
        const payload = (await response.json()) as { hotels?: Array<{ id: string }> };
        if (seq !== requestSeq.current) return;
        setVisibleOfficialIds((payload.hotels ?? []).map((hotel) => hotel.id));
        setViewportReady(true);
      } catch {
        if (seq !== requestSeq.current) return;
        setBoundsError("Unable to refresh official hotels for this map area.");
        setViewportReady(true);
      }
    });
  }

  async function refreshMarketplace(bounds: HotelMapBounds | null, explicitSearch: boolean) {
    if (!marketplaceActive && !explicitSearch) return;
    const seq = ++marketplaceSeq.current;
    setMarketplaceBusy(true);
    setMarketplaceError("");
    try {
      const response = await fetch("/api/travel/marketplace/hotels/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          checkIn,
          checkOut,
          adults,
          ...(bounds ? toSearchBoundsPayload(bounds) : {}),
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (seq !== marketplaceSeq.current) return;
      if (json?.code === "validation_error" || (!response.ok && !json?.reason && !json?.code)) {
        throw new Error(json.error || "Hotel search failed.");
      }
      setMarketplaceActive(true);
      setMarketplaceCode(json.code ?? (response.ok ? "results" : "provider_not_configured"));
      setMarketplaceProvider(json.provider ?? null);
      setMarketplaceReason(json.reason || json.error || "");
      setMarketplaceOffers(Array.isArray(json.offers) ? json.offers : []);
    } catch (err) {
      if (seq !== marketplaceSeq.current) return;
      setMarketplaceError(err instanceof Error ? err.message : "Hotel search failed.");
      setMarketplaceCode("validation_error");
      setMarketplaceOffers([]);
    } finally {
      if (seq === marketplaceSeq.current) setMarketplaceBusy(false);
    }
  }

  const handleBoundsChange = (bounds: HotelMapBounds) => {
    lastBounds.current = bounds;
    void refreshOfficialBounds(bounds);
    if (boundsTimer.current) clearTimeout(boundsTimer.current);
    boundsTimer.current = setTimeout(() => {
      void refreshMarketplace(bounds, false);
    }, 450);
  };

  const viewportEmpty =
    viewportReady &&
    visibleOfficialIds !== null &&
    !officialRows.length &&
    !(marketplaceOffers && marketplaceOffers.length);

  useEffect(() => {
    return () => {
      if (boundsTimer.current) clearTimeout(boundsTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!lastBounds.current) return;
    void refreshOfficialBounds(lastBounds.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when search dates change
  }, [searched, checkIn, checkOut]);

  async function onSearch() {
    setSearched(true);
    setMarketplaceActive(true);
    await refreshMarketplace(lastBounds.current, true);
  }

  return (
    <>
      <section id="hotel-search" className="ct-hotel-search" aria-label="Search hotels">
        <label className="ct-hotel-search__field ct-hotel-search__field--destination">
          <span>Destination</span>
          <span className="ct-hotel-search__control">
            <MapPin aria-hidden="true" />
            <input
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="City or airport (US)"
              autoComplete="off"
            />
          </span>
        </label>
        <label className="ct-hotel-search__field">
          <span>Check-in</span>
          <span className="ct-hotel-search__control">
            <input
              type="date"
              value={checkIn}
              onChange={(event) => setCheckIn(event.target.value)}
              suppressHydrationWarning
            />
            <CalendarDays aria-hidden="true" />
          </span>
        </label>
        <label className="ct-hotel-search__field">
          <span>Check-out</span>
          <span className="ct-hotel-search__control">
            <input
              type="date"
              value={checkOut}
              min={checkIn || undefined}
              onChange={(event) => setCheckOut(event.target.value)}
              suppressHydrationWarning
            />
            <CalendarDays aria-hidden="true" />
          </span>
        </label>
        <label className="ct-hotel-search__field">
          <span>Adults</span>
          <span className="ct-hotel-search__control">
            <select value={adults} onChange={(event) => setAdults(Number(event.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </span>
        </label>
        <button
          type="button"
          className="ct-neon-button ct-hotel-search__submit"
          disabled={marketplaceBusy}
          onClick={() => void onSearch()}
        >
          {marketplaceBusy ? "Searching…" : "Search Hotels"} <Search aria-hidden="true" />
        </button>
      </section>

      <section className="ct-hotel-explorer" aria-label="Hotel list and live map">
        <div className="ct-hotel-explorer__sidebar">
          <div className="ct-hotel-explorer__sidebar-meta" aria-live="polite">
            <p>
              {visibleOfficialIds
                ? `${officialRows.length} official · ${marketplaceOffers?.length ?? 0} marketplace in map view`
                : `${officialRows.length} official hotel${officialRows.length === 1 ? "" : "s"}`}
              {isRefreshing || marketplaceBusy || !viewportReady ? " · LOADING…" : ""}
            </p>
            {tileError ? (
              <p className="ct-hotel-explorer__error" role="alert">
                ERROR: {tileError}
              </p>
            ) : null}
            {boundsError ? (
              <p className="ct-hotel-explorer__error" role="alert">
                ERROR: {boundsError}
              </p>
            ) : null}
            {marketplaceError ? (
              <p className="ct-hotel-explorer__error" role="alert">
                ERROR: {marketplaceError}
              </p>
            ) : null}
          </div>

          <div className="ct-hotel-results" aria-live="polite">
            {(isRefreshing || !viewportReady) && visibleOfficialIds === null ? (
              <div className="ct-hotel-explorer__skeleton" aria-busy="true" aria-label="LOADING hotel list">
                <span />
                <span />
                <span />
              </div>
            ) : null}

            {viewportEmpty ? (
              <p className="ct-hotel-explorer__empty" data-state="EMPTY">
                EMPTY — No hotels rest in the current map viewport. Pan or zoom to refresh the sidebar from live
                coordinates.
              </p>
            ) : null}

            {!officialPins.length && !marketplacePins.length ? (
              <p className="ct-hotel-explorer__empty">
                No hotel coordinates are available yet, so the inventory map cannot place pins. Official hotels
                still list below when published; marketplace pins appear only when live providers return latitude
                and longitude.
              </p>
            ) : null}

            <h3 className="ct-hotel-explorer__lane-title">Official COGIC hotels</h3>
            {visibleOfficialIds && !officialRows.length && !viewportEmpty ? (
              <p className="ct-hotel-explorer__empty">
                No official hotels in this map area. Pan or zoom to refresh.
              </p>
            ) : null}
            {officialRows.map((hotel) => {
              const image = resolveHotelImage(hotel);
              const availability = searched
                ? hotel.rank === 0
                  ? {
                      className: "is-available",
                      icon: CircleCheck,
                      message: "A room type can satisfy these dates.",
                    }
                  : hotel.rank === 1
                    ? {
                        className: "is-partial",
                        icon: CircleAlert,
                        message: "Partial COGIC availability is shown for these dates.",
                      }
                    : {
                        className: "is-unavailable",
                        icon: CircleX,
                        message: "No COGIC rooms currently shown for these dates.",
                      }
                : null;
              const AvailabilityIcon = availability?.icon;

              return (
                <article key={hotel.id} className="ct-hotel-result-card">
                  <div className="ct-hotel-result-card__media">
                    {image ? (
                      <Image
                        src={image}
                        fill
                        sizes="(max-width: 900px) 100vw, 32vw"
                        alt={hotel.name}
                        className="ct-hotel-result-card__image"
                      />
                    ) : (
                      <div className="ct-hotel-result-card__image-placeholder">
                        Official hotel image coming soon
                      </div>
                    )}
                    <span className="ct-hotel-result-card__designation">
                      {hotel.cogic_designation === "BISHOPS" ? "Bishops Hotel" : "Official COGIC Housing"}
                    </span>
                  </div>

                  <div className="ct-hotel-result-card__details">
                    <div>
                      <h3>{hotel.name}</h3>
                      <div className="ct-hotel-result-card__tags">
                        {hotel.cogic_designation === "GENERAL" ? <span>General</span> : null}
                        {hotel.minimum_nights ? <span>{hotel.minimum_nights} night minimum</span> : null}
                        {hotel.latitude != null && hotel.longitude != null ? (
                          <span>
                            {hotel.latitude.toFixed(4)}, {hotel.longitude.toFixed(4)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="ct-hotel-result-card__rate">
                      <span>From</span>
                      <strong>
                        {hotel.negotiated_rate_cents != null
                          ? money(hotel.negotiated_rate_cents, hotel.rate_currency)
                          : "\u2014"}
                      </strong>
                      <small>/ night</small>
                    </p>
                    {hotel.travel_hotel_room_types?.length ? (
                      <ul className="ct-hotel-result-card__rooms">
                        {hotel.travel_hotel_room_types.map((room) => (
                          <li key={room.id}>{room.name}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <div className="ct-hotel-result-card__availability">
                    {availability && AvailabilityIcon ? (
                      <p className={availability.className}>
                        <AvailabilityIcon aria-hidden="true" />
                        {availability.message}
                      </p>
                    ) : (
                      <p className="ct-hotel-result-card__availability-hint">
                        Choose dates to check COGIC availability.
                      </p>
                    )}
                    <Link
                      href={`/travel/hotels/${hotel.slug || hotel.id}?checkIn=${checkIn}&checkOut=${checkOut}`}
                      className="ct-neon-button ct-hotel-result-card__action"
                    >
                      View Rooms &amp; Availability <ChevronRight aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              );
            })}

            <h3 className="ct-hotel-explorer__lane-title">US marketplace hotels</h3>
            {marketplaceBusy && !marketplaceOffers ? (
              <div className="ct-hotel-explorer__skeleton" aria-busy="true" aria-label="Loading marketplace hotels">
                <span />
                <span />
                <span />
              </div>
            ) : null}
            {marketplaceOffers && marketplaceCode === "results" && marketplaceOffers.length ? (
              <>
                <p className="ct-honest-hint">
                  Showing {marketplaceOffers.length} live offer{marketplaceOffers.length === 1 ? "" : "s"}
                  {marketplaceProvider ? ` via ${marketplaceProvider}` : ""} in the current map viewport.
                  Checkout securely in-app; supplier confirmation is captured automatically after card approval.
                </p>
                <ul className="ct-marketplace-offer-list">
                  {marketplaceOffers.map((offer) => (
                    <li key={offer.id} className="ct-marketplace-offer">
                      <div>
                        <strong>{offer.name}</strong>
                        <p>
                          {[offer.city, offer.state].filter(Boolean).join(", ") || "United States"}
                          {offer.roomName ? ` · ${offer.roomName}` : ""}
                          {offer.starRating != null ? (
                            <>
                              {" · "}
                              <Star aria-hidden="true" className="ct-inline-star" /> {offer.starRating.toFixed(1)}
                            </>
                          ) : null}
                        </p>
                        <p>
                          {offer.nightlyRateCents != null
                            ? `${money(offer.nightlyRateCents, offer.currency)} / night est.`
                            : "Rate on offer"}
                          {offer.totalRateCents != null
                            ? ` · Total ${money(offer.totalRateCents, offer.currency)}`
                            : ""}
                        </p>
                      </div>
                      <MarketplaceOfferActions
                        kind="hotel"
                        offer={offer as unknown as Record<string, unknown>}
                        checkIn={checkIn}
                        checkOut={checkOut}
                        label="Checkout securely"
                      />
                    </li>
                  ))}
                </ul>
              </>
            ) : marketplaceOffers ? (
              <MarketplaceSearchOutcome
                code={marketplaceCode}
                reason={marketplaceReason}
                showOfficialHotelsLink={false}
              />
            ) : (
              <p className="ct-honest-hint">
                Search any US city to load live marketplace rates. Pan or zoom the map to refresh marketplace
                results for the current viewport. Official COGIC hotels stay listed above.
              </p>
            )}
          </div>
        </div>

        <div className="ct-hotel-explorer__map-pane">
          {mapPins.length ? (
            <>
              {tileError ? (
                <div className="ct-hotel-map__error-banner" role="alert">
                  <div>
                    <strong>ERROR</strong>
                    <p>{tileError}</p>
                  </div>
                  <button
                    type="button"
                    className="ct-neon-button"
                    onClick={() => {
                      setTileError(null);
                      window.location.reload();
                    }}
                  >
                    Reload map
                  </button>
                </div>
              ) : null}
              <HotelsInventoryMap
                pins={mapPins}
                checkIn={checkIn}
                checkOut={checkOut}
                onBoundsChange={handleBoundsChange}
                onTileError={() =>
                  setTileError(
                    "Map tile requests failed. The canvas may be incomplete — reload if pins or basemap stay blank.",
                  )
                }
              />
            </>
          ) : (
            <div className="ct-hotel-map ct-hotel-map--empty" data-state="EMPTY">
              EMPTY — Live map requires published latitude and longitude. No pin-ready coordinates are available
              yet.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
