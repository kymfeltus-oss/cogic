"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { ChevronRight, Star, X } from "lucide-react";
import MarketplaceOfferActions from "@/components/travel/MarketplaceOfferActions";
import { normalizeMapBounds } from "@/lib/travel/map-bounds";
import type { HotelMapBounds, HotelMapPin } from "./types";
import "leaflet/dist/leaflet.css";

const STL_CENTER: [number, number] = [38.6285, -90.191];
const money = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    value / 100,
  );

function pinIcon(active: boolean, source: HotelMapPin["source"]) {
  return L.divIcon({
    className: "ct-hotel-map-pin",
    html: `<span class="ct-hotel-map-pin__dot${active ? " is-active" : ""}${
      source === "marketplace" ? " is-marketplace" : ""
    }" aria-hidden="true"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -12],
  });
}

function BoundsEvents({
  onBoundsChange,
}: {
  onBoundsChange: (bounds: HotelMapBounds) => void;
}) {
  const map = useMap();

  const emit = () => {
    const b = map.getBounds();
    const normalized = normalizeMapBounds({
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    });
    if (normalized) onBoundsChange(normalized);
  };

  useMapEvents({
    moveend: emit,
    zoomend: emit,
  });

  useEffect(() => {
    emit();
    // Emit once after mount so the sidebar syncs to the initial viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot bootstrap
  }, []);

  return null;
}

function FitPins({ pins }: { pins: HotelMapPin[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || !pins.length) return;
    fitted.current = true;
    const bounds = L.latLngBounds(pins.map((pin) => [pin.latitude, pin.longitude]));
    map.fitBounds(bounds.pad(0.22), { animate: false, maxZoom: 15 });
  }, [map, pins]);
  return null;
}

function TileErrorBridge({ onTileError }: { onTileError: () => void }) {
  useMapEvents({
    tileerror: () => onTileError(),
  });
  return null;
}

export default function HotelsInventoryMap({
  pins,
  checkIn,
  checkOut,
  onBoundsChange,
  onTileError,
}: {
  pins: HotelMapPin[];
  checkIn: string;
  checkOut: string;
  onBoundsChange: (bounds: HotelMapBounds) => void;
  onTileError?: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tilesReady, setTilesReady] = useState(false);
  const selected = useMemo(
    () => pins.find((pin) => pin.id === selectedId) ?? null,
    [pins, selectedId],
  );

  useEffect(() => {
    if (selectedId && !pins.some((pin) => pin.id === selectedId)) {
      setSelectedId(null);
    }
  }, [pins, selectedId]);

  const nightlyCents = selected?.negotiatedRateCents ?? selected?.nightlyRateCents ?? null;
  const rateCents = nightlyCents ?? selected?.totalRateCents ?? null;

  return (
    <div className="ct-hotel-map" data-tiles-ready={tilesReady ? "1" : "0"}>
      {!tilesReady ? (
        <div className="ct-hotel-map__boot-skel" aria-busy="true" aria-label="Loading map tiles">
          <span />
          <span />
          <span />
        </div>
      ) : null}

      <MapContainer
        className="ct-hotel-map__canvas"
        center={STL_CENTER}
        zoom={14}
        scrollWheelZoom
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            load: () => setTilesReady(true),
            tileerror: () => {
              setTilesReady(true);
              onTileError?.();
            },
          }}
        />
        <TileErrorBridge
          onTileError={() => {
            setTilesReady(true);
            onTileError?.();
          }}
        />
        <FitPins pins={pins} />
        <BoundsEvents onBoundsChange={onBoundsChange} />
        {pins.map((pin) => (
          <Marker
            key={`${pin.source}:${pin.id}`}
            position={[pin.latitude, pin.longitude]}
            icon={pinIcon(pin.id === selectedId, pin.source)}
            eventHandlers={{
              click: () => setSelectedId(pin.id),
            }}
          />
        ))}
      </MapContainer>

      <div
        className={`ct-hotel-map__chip${selected ? " is-open" : ""}`}
        role="dialog"
        aria-label={selected ? `${selected.name} map preview` : "Hotel map preview"}
        aria-hidden={!selected}
      >
        {selected ? (
          <>
            <button
              type="button"
              className="ct-hotel-map__chip-close"
              aria-label="Close hotel preview"
              onClick={() => setSelectedId(null)}
            >
              <X aria-hidden="true" />
            </button>
            <div className="ct-hotel-map__chip-media">
              {selected.imageUrl ? (
                <Image
                  src={selected.imageUrl}
                  alt={selected.name}
                  fill
                  sizes="280px"
                  className="ct-hotel-map__chip-image"
                  unoptimized={selected.source === "marketplace"}
                />
              ) : (
                <div className="ct-hotel-map__chip-placeholder">
                  {selected.source === "official"
                    ? "Official hotel image coming soon"
                    : "Live partner image unavailable"}
                </div>
              )}
            </div>
            <div className="ct-hotel-map__chip-body">
              <h3>{selected.name}</h3>
              <div className="ct-hotel-map__chip-marks">
                {selected.starRating != null ? (
                  <span className="ct-hotel-map__chip-star">
                    <Star aria-hidden="true" /> {selected.starRating.toFixed(1)}
                  </span>
                ) : (
                  <span className="ct-hotel-map__chip-star">
                    {selected.source === "official" ? "Official rating" : "Partner listing"}
                  </span>
                )}
                {selected.ratingMarks.slice(0, 2).map((mark) => (
                  <span key={mark}>{mark}</span>
                ))}
              </div>
              <p className="ct-hotel-map__chip-rate">
                <span>{nightlyCents != null ? "Nightly" : "From"}</span>
                <strong>
                  {rateCents != null ? money(rateCents, selected.currency) : "\u2014"}
                </strong>
                {nightlyCents != null ? <small>/ night</small> : null}
              </p>
              {selected.pricingTiers.length ? (
                <ul className="ct-hotel-map__chip-tiers">
                  {selected.pricingTiers.slice(0, 3).map((tier) => (
                    <li key={tier.id}>
                      <span>{tier.name}</span>
                      <strong>{money(tier.nightlyRateCents, selected.currency)}</strong>
                    </li>
                  ))}
                </ul>
              ) : null}
              {selected.profileHref ? (
                <Link href={selected.profileHref} className="ct-neon-button ct-hotel-map__chip-cta">
                  View hotel details <ChevronRight aria-hidden="true" />
                </Link>
              ) : null}
              {selected.source === "marketplace" && selected.marketplaceOffer ? (
                <MarketplaceOfferActions
                  kind="hotel"
                  offer={selected.marketplaceOffer}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  label="Checkout securely"
                />
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
