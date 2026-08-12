"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TravelHotel } from "@/lib/travel/types";
import { roomForStay, stayDates } from "@/lib/travel/hotel-availability";

const money = (n: number) => `$${(n / 100).toFixed(0)}`;

export default function HotelAvailabilityClient({
  hotel,
  initialCheckIn,
  initialCheckOut,
}: {
  hotel: TravelHotel;
  initialCheckIn: string;
  initialCheckOut: string;
}) {
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const rooms = hotel.travel_hotel_room_types ?? [];
  const dates = useMemo(() => stayDates(checkIn, checkOut), [checkIn, checkOut]);
  const calendarDates = useMemo(() => {
    const start = new Date(`${checkIn}T12:00:00Z`);
    if (!Number.isFinite(start.valueOf())) return [];
    return Array.from({ length: 14 }, (_, i) =>
      new Date(start.valueOf() + i * 86400000).toISOString().slice(0, 10),
    );
  }, [checkIn]);

  async function saveInterest() {
    setBusy(true);
    setError("");
    setSaved(false);
    setSavedMessage("");
    setJourneyId(null);
    const response = await fetch("/api/travel/hotel-booking/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotelId: hotel.id, checkIn, checkOut }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (json.loginUrl) {
        window.location.href = json.loginUrl;
        return;
      }
      setError(json.error || "Unable to save your housing interest.");
      setBusy(false);
      return;
    }

    // Stay on this page for browse-and-request DRAFT interest — never follow redirectTo.
    if (json.redirectTo) {
      // Intentionally ignored: Official Lane A must not auto-navigate after interest save.
    }
    if (json.mode && json.mode !== "browse_and_request") {
      setError("Unexpected booking response. Official hotels are browse-and-request only.");
      setBusy(false);
      return;
    }

    setJourneyId(json.journeyId ? String(json.journeyId) : null);
    setSaved(true);
    setSavedMessage(
      String(json.message || "").trim() ||
        "Interest saved. Contact COGIC Housing to complete your official stay — this app does not charge or confirm negotiated housing.",
    );
    setBusy(false);
  }

  return (
    <section className="mt-10">
      <h2 className="text-3xl font-bold">COGIC Published Availability</h2>
      <p className="mt-2 text-white/65">
        Availability reflects the latest COGIC housing information loaded into COGIC Travel and may change.
        It is not real-time inventory, and this page does not complete an in-app reservation or payment.
      </p>
      <div className="mt-6 grid gap-4 rounded-2xl border border-white/15 bg-white/[.05] p-5 sm:grid-cols-3">
        <label className="text-lg">
          Check-in
          <input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="mt-2 min-h-14 w-full rounded-xl bg-white p-3 text-black"
          />
        </label>
        <label className="text-lg">
          Check-out
          <input
            type="date"
            value={checkOut}
            min={checkIn || undefined}
            onChange={(e) => setCheckOut(e.target.value)}
            className="mt-2 min-h-14 w-full rounded-xl bg-white p-3 text-black"
          />
        </label>
        <div className="self-end rounded-xl bg-white/10 p-4">
          {dates.length ? `${dates.length} nights` : "Choose a valid stay"}
        </div>
      </div>
      {hotel.minimum_nights && dates.length > 0 && dates.length < hotel.minimum_nights ? (
        <p role="alert" className="mt-4 rounded-xl bg-amber-300/15 p-4">
          This listing requires a minimum stay of {hotel.minimum_nights} nights.
        </p>
      ) : null}
      <div className="mt-7 grid gap-4">
        {rooms.map((room) => {
          const stay = roomForStay(room, checkIn, checkOut, hotel.minimum_nights);
          return (
            <article key={room.id} className="rounded-2xl border border-white/15 bg-white/[.05] p-5">
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold">{room.name}</h3>
                  <p className="text-xl text-[#efc23e]">
                    {money(room.nightly_rate_cents)} / night when available
                  </p>
                </div>
                {stay ? (
                  <div className="text-right">
                    <strong className="text-2xl">{money(stay.subtotalCents)}</strong>
                    <p>Estimated subtotal · {stay.nights} nights</p>
                  </div>
                ) : (
                  <p className="rounded-xl bg-white/10 p-3">
                    No COGIC rooms currently shown for these dates.
                  </p>
                )}
              </div>
              {stay ? (
                <p className="mt-4 text-sm text-white/60">
                  Before taxes and hotel fees. This is not a reservation.
                </p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-4">
                  <Link href="/travel/hotels" className="underline">
                    View Other Official Hotels
                  </Link>
                  <a href="mailto:housing@cogic.org" className="underline">
                    Contact COGIC Housing
                  </a>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-white/15">
        <table className="min-w-[760px] w-full">
          <caption className="p-4 text-left text-2xl font-bold">
            November 2026 availability calendar
          </caption>
          <thead>
            <tr>
              <th className="p-3 text-left">Room type</th>
              {calendarDates.map((d) => (
                <th key={d}>{Number(d.slice(-2))}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="border-t border-white/10">
                <th className="p-3 text-left">{room.name}</th>
                {calendarDates.map((d) => {
                  const n = room.travel_hotel_nightly_availability.find((x) => x.stay_date === d);
                  return (
                    <td
                      className={`p-3 text-center ${
                        n?.availability_status === "AVAILABLE" ? "text-[#efc23e]" : "text-white/35"
                      }`}
                      key={d}
                    >
                      {n?.availability_status === "AVAILABLE" ? money(n.nightly_rate_cents) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-white/60">
        <b className="text-[#efc23e]">$RATE</b> = Available at COGIC published rate · <b>—</b> = Unavailable
      </p>
      {error ? (
        <p role="alert" className="mt-5 text-red-300">
          {error}
        </p>
      ) : null}
      {saved ? (
        <div
          role="status"
          className="mt-5 rounded-xl border border-emerald-300/35 bg-emerald-300/15 p-4 text-emerald-100"
        >
          <p className="text-lg font-bold">Interest Saved / Contacting Housing</p>
          <p className="mt-2">{savedMessage}</p>
          {journeyId ? (
            <p className="mt-2 text-sm text-emerald-100/80">Interest reference saved on this page.</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="mailto:housing@cogic.org"
              className="inline-flex min-h-12 items-center rounded-xl bg-[#d8ab2e] px-5 font-bold text-black"
            >
              Contact COGIC Housing
            </a>
            <Link
              href="/travel/trip"
              className="inline-flex min-h-12 items-center rounded-xl bg-white/10 px-5 font-bold"
            >
              View on My Trip
            </Link>
          </div>
        </div>
      ) : null}
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || saved}
          onClick={() => void saveInterest()}
          className="min-h-14 rounded-xl bg-[#d8ab2e] px-7 text-lg font-bold text-black disabled:opacity-60"
        >
          {busy ? "Saving…" : saved ? "Interest saved" : "Save housing interest"}
        </button>
        <a
          href="mailto:housing@cogic.org"
          className="inline-flex min-h-14 items-center rounded-xl bg-white/10 px-7 text-lg font-bold"
        >
          Contact COGIC Housing
        </a>
        <Link
          href="/travel"
          className="inline-flex min-h-14 items-center rounded-xl px-7 text-lg font-bold underline"
        >
          Search marketplace hotels
        </Link>
      </div>
      <p className="mt-3 text-sm text-white/60">
        Official COGIC negotiated hotels are browse-and-request only until a live housing CRS is connected.
        Marketplace hotels use secure in-app Stripe checkout with supplier confirmation.
      </p>
    </section>
  );
}
