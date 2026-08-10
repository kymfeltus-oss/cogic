"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  MapPin,
  Search,
} from "lucide-react";
import type { TravelHotel } from "@/lib/travel/types";
import { hotelAvailabilityRank } from "@/lib/travel/hotel-availability";
import { resolveHotelImage } from "@/lib/travel/hotel-images";

const money = (value: number) => `$${(value / 100).toFixed(0)}`;

export default function OfficialHotelsClient({ hotels }: { hotels: TravelHotel[] }) {
  const [checkIn, setCheckIn] = useState("2026-11-03");
  const [checkOut, setCheckOut] = useState("2026-11-09");
  const [searched, setSearched] = useState(false);
  const rows = useMemo(
    () =>
      hotels
        .map((hotel) => ({
          ...hotel,
          rank: searched
            ? hotelAvailabilityRank(hotel.travel_hotel_room_types ?? [], checkIn, checkOut, hotel.minimum_nights)
            : 0,
        }))
        .sort((first, second) => first.rank - second.rank),
    [hotels, checkIn, checkOut, searched],
  );

  return (
    <>
      <section id="hotel-search" className="ct-hotel-search" aria-label="Search official COGIC hotels">
        <label className="ct-hotel-search__field ct-hotel-search__field--destination">
          <span>Destination</span>
          <span className="ct-hotel-search__control">
            <MapPin aria-hidden="true" />
            <input readOnly value="St. Louis, Missouri" />
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
        <button type="button" className="ct-neon-button ct-hotel-search__submit" onClick={() => setSearched(true)}>
          Search Official Hotels <Search aria-hidden="true" />
        </button>
      </section>

      <section className="ct-hotel-results" aria-live="polite">
        {rows.map((hotel) => {
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
                  <div className="ct-hotel-result-card__image-placeholder">Official hotel image coming soon</div>
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
                  </div>
                </div>
                <p className="ct-hotel-result-card__rate">
                  <span>From</span>
                  <strong>{hotel.negotiated_rate_cents != null ? money(hotel.negotiated_rate_cents) : "\u2014"}</strong>
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
                  <p className="ct-hotel-result-card__availability-hint">Choose dates to check COGIC availability.</p>
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
      </section>
    </>
  );
}
