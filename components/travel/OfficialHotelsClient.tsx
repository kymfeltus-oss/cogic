"use client";

import { BedDouble } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { hotelAvailabilityRank } from "@/lib/travel/hotel-availability";
import { resolveHotelImage } from "@/lib/travel/hotel-images";
import type { TravelHotel } from "@/lib/travel/types";

const money = (n: number) => `$${(n / 100).toFixed(0)}`;

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
        .sort((a, b) => a.rank - b.rank),
    [hotels, checkIn, checkOut, searched],
  );

  return (
    <>
      <section className="ct-card ct-card--primary ct-hotel-search-form" aria-label="Official hotel search">
        <label>
          Destination
          <input readOnly value="St. Louis, Missouri" />
        </label>
        <label>
          Check-in
          <input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} />
        </label>
        <label>
          Check-out
          <input
            type="date"
            value={checkOut}
            min={checkIn || undefined}
            onChange={(event) => setCheckOut(event.target.value)}
          />
        </label>
        <button type="button" className="ct-search-submit" onClick={() => setSearched(true)}>
          Search Official Hotels
        </button>
      </section>

      <section className="ct-hotel-results" aria-live="polite">
        {rows.map((hotel) => {
          const image = resolveHotelImage(hotel);
          const designation = hotel.cogic_designation === "BISHOPS" ? "Bishops Hotel" : "Official COGIC Housing";
          const availabilityClass =
            hotel.rank === 0
              ? "ct-hotel-result-card__availability--available"
              : hotel.rank === 1
                ? "ct-hotel-result-card__availability--partial"
                : "ct-hotel-result-card__availability--unavailable";

          return (
            <article key={hotel.id} className="ct-card ct-card--feature ct-hotel-result-card">
              <div className="ct-hotel-result-card__photo">
                {image ? (
                  <Image src={image} fill sizes="(max-width: 768px) 100vw, 50vw" alt={hotel.name} className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/45">
                    Official hotel image coming soon
                  </div>
                )}
                <span className="ct-hotel-result-card__official">{designation}</span>
              </div>

              <div className="ct-hotel-result-card__body">
                <div className="ct-hotel-result-card__heading">
                  <span className="ct-card-icon ct-card-icon--gold" aria-hidden="true">
                    <BedDouble />
                  </span>
                  <div>
                    <p className="ct-hotel-result-card__eyebrow">{designation.toUpperCase()}</p>
                    <h2>{hotel.name}</h2>
                  </div>
                </div>

                <div className="ct-hotel-result-card__tags">
                  {hotel.cogic_designation === "GENERAL" ? <span>GENERAL</span> : null}
                  {hotel.minimum_nights ? <span>{hotel.minimum_nights} NIGHT MINIMUM</span> : null}
                </div>

                <p className="ct-rate-chip">
                  Official COGIC rate
                  <strong>FROM {hotel.negotiated_rate_cents != null ? money(hotel.negotiated_rate_cents) : "\u2014"} / NIGHT</strong>
                </p>

                <p className="ct-hotel-result-card__rooms">
                  {hotel.travel_hotel_room_types?.map((room) => room.name).join(" \u00b7 ")}
                </p>

                {searched ? (
                  <p className={`ct-hotel-result-card__availability ${availabilityClass}`}>
                    {hotel.rank === 0
                      ? "A room type can satisfy these dates."
                      : hotel.rank === 1
                        ? "Partial COGIC availability is shown for these dates."
                        : "No COGIC rooms currently shown for these dates."}
                  </p>
                ) : null}

                <Link
                  href={`/travel/hotels/${hotel.slug || hotel.id}?checkIn=${checkIn}&checkOut=${checkOut}`}
                  className="ct-hotel-result-card__cta"
                >
                  View Rooms &amp; Availability
                </Link>
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
