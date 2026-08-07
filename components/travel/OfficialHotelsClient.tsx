"use client";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { TravelHotel } from "@/lib/travel/types";
import { hotelAvailabilityRank } from "@/lib/travel/hotel-availability";
import { resolveHotelImage } from "@/lib/travel/hotel-images";

const money = (n: number) => `$${(n / 100).toFixed(0)}`;

export default function OfficialHotelsClient({ hotels }: { hotels: TravelHotel[] }) {
  const [checkIn, setCheckIn] = useState("2026-11-03");
  const [checkOut, setCheckOut] = useState("2026-11-09");
  const [searched, setSearched] = useState(false);
  const rows = useMemo(
    () =>
      hotels
        .map((h) => ({
          ...h,
          rank: searched ? hotelAvailabilityRank(h.travel_hotel_room_types ?? [], checkIn, checkOut, h.minimum_nights) : 0,
        }))
        .sort((a, b) => a.rank - b.rank),
    [hotels, checkIn, checkOut, searched],
  );

  return (
    <>
      <section className="mt-8 grid gap-4 rounded-3xl border border-white/15 bg-white/[.06] p-6 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <label className="grid gap-2 text-lg">
          Destination
          <input readOnly value="St. Louis, Missouri" className="min-h-14 w-full rounded-xl bg-white px-4 text-black" />
        </label>
        <label className="grid gap-2 text-lg">
          Check-in
          <input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="min-h-14 w-full rounded-xl bg-white px-4 text-black"
          />
        </label>
        <label className="grid gap-2 text-lg">
          Check-out
          <input
            type="date"
            value={checkOut}
            min={checkIn || undefined}
            onChange={(e) => setCheckOut(e.target.value)}
            className="min-h-14 w-full rounded-xl bg-white px-4 text-black"
          />
        </label>
        <button
          onClick={() => setSearched(true)}
          className="min-h-14 rounded-xl bg-[#d8ab2e] px-5 font-bold text-black lg:mt-8"
        >
          Search Official Hotels
        </button>
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-2">
        {rows.map((h) => {
          const image = resolveHotelImage(h);
          return (
            <article key={h.id} className="flex flex-col overflow-hidden rounded-3xl border border-white/15 bg-white/[.06]">
              <div className="relative h-52 shrink-0 bg-[#111526]">
                {image ? (
                  <Image src={image} fill sizes="(max-width: 768px) 100vw, 50vw" alt={h.name} className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/45">
                    Official hotel image coming soon
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-6">
                <p className="font-black tracking-[.12em] text-[#efc23e]">
                  {h.cogic_designation === "BISHOPS" ? "BISHOPS HOTEL" : "OFFICIAL COGIC HOUSING"}
                </p>
                <h2 className="mt-3 text-3xl font-bold">{h.name}</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {h.cogic_designation === "GENERAL" ? (
                    <span className="rounded-full bg-white/10 px-3 py-1">GENERAL</span>
                  ) : null}
                  {h.minimum_nights ? (
                    <span className="rounded-full bg-[#d54cff]/20 px-3 py-1">{h.minimum_nights} NIGHT MINIMUM</span>
                  ) : null}
                </div>
                <p className="mt-5 text-2xl font-bold">
                  FROM {h.negotiated_rate_cents != null ? money(h.negotiated_rate_cents) : "—"} / NIGHT
                </p>
                <p className="mt-3 leading-7 text-white/70">{h.travel_hotel_room_types?.map((r) => r.name).join(" · ")}</p>
                {searched ? (
                  <p
                    className={`mt-4 rounded-xl p-3 ${
                      h.rank === 0
                        ? "bg-green-400/15 text-green-200"
                        : h.rank === 1
                          ? "bg-amber-300/15 text-amber-100"
                          : "bg-white/10 text-white/70"
                    }`}
                  >
                    {h.rank === 0
                      ? "A room type can satisfy these dates."
                      : h.rank === 1
                        ? "Partial COGIC availability is shown for these dates."
                        : "No COGIC rooms currently shown for these dates."}
                  </p>
                ) : null}
                <Link
                  href={`/travel/hotels/${h.slug || h.id}?checkIn=${checkIn}&checkOut=${checkOut}`}
                  className="mt-6 inline-flex min-h-12 items-center self-start rounded-xl bg-[#5c24b5] px-5 font-bold"
                >
                  View Rooms & Availability
                </Link>
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
