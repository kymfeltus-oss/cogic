"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { roomForStay, stayDates } from "@/lib/travel/hotel-availability";
import type { TravelHotel } from "@/lib/travel/types";

const money = (value: number) => `$${(value / 100).toFixed(0)}`;

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
  const rooms = hotel.travel_hotel_room_types ?? [];
  const dates = useMemo(() => stayDates(checkIn, checkOut), [checkIn, checkOut]);
  const calendarDates = useMemo(() => {
    const start = new Date(`${checkIn}T12:00:00Z`);
    if (!Number.isFinite(start.valueOf())) return [];
    return Array.from({ length: 14 }, (_, index) => new Date(start.valueOf() + index * 86400000).toISOString().slice(0, 10));
  }, [checkIn]);

  async function startBooking() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/travel/hotel-booking/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotelId: hotel.id, checkIn, checkOut }),
    });
    const payload = await response.json();
    if (!response.ok) {
      if (payload.loginUrl) {
        window.location.href = payload.loginUrl;
        return;
      }
      setError(payload.error || "Unable to continue.");
      setBusy(false);
      return;
    }
    window.location.href = payload.redirectTo;
  }

  return (
    <section className="ct-availability">
      <h2>COGIC Published Availability</h2>
      <p>
        Availability reflects the latest COGIC housing information loaded into COGIC Travel and may change. It is not
        real-time inventory.
      </p>

      <div className="ct-card ct-card--feature ct-availability__stay-form">
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
        <div className="ct-availability__stay-summary">{dates.length ? `${dates.length} nights` : "Choose a valid stay"}</div>
      </div>

      {hotel.minimum_nights && dates.length > 0 && dates.length < hotel.minimum_nights ? (
        <p role="alert" className="ct-availability__warning">
          This listing requires a minimum stay of {hotel.minimum_nights} nights.
        </p>
      ) : null}

      <div className="ct-room-list">
        {rooms.map((room) => {
          const stay = roomForStay(room, checkIn, checkOut, hotel.minimum_nights);
          return (
            <article key={room.id} className="ct-card ct-card--feature ct-room-card">
              <div className="ct-room-card__top">
                <div>
                  <h3>{room.name}</h3>
                  <p className="ct-room-card__rate">{money(room.nightly_rate_cents)} / night when available</p>
                </div>
                {stay ? (
                  <div className="ct-room-card__subtotal">
                    <strong>{money(stay.subtotalCents)}</strong>
                    <p>Estimated subtotal · {stay.nights} nights</p>
                  </div>
                ) : (
                  <p className="ct-room-card__unavailable">No COGIC rooms currently shown for these dates.</p>
                )}
              </div>
              {stay ? (
                <p className="ct-room-card__note">Before taxes and hotel fees. This is not a reservation.</p>
              ) : (
                <div className="ct-room-card__links">
                  <Link href="/travel/hotels">View Other Official Hotels</Link>
                  <a href="mailto:housing@cogic.org">Contact COGIC Housing</a>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="ct-availability__table-wrap">
        <table className="ct-availability__table">
          <caption>November 2026 availability calendar</caption>
          <thead>
            <tr>
              <th>Room type</th>
              {calendarDates.map((date) => (
                <th key={date}>{Number(date.slice(-2))}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id}>
                <th>{room.name}</th>
                {calendarDates.map((date) => {
                  const nightlyAvailability = room.travel_hotel_nightly_availability.find((night) => night.stay_date === date);
                  const isAvailable = nightlyAvailability?.availability_status === "AVAILABLE";
                  return (
                    <td className={isAvailable ? "is-available" : "is-unavailable"} key={date}>
                      {isAvailable ? money(nightlyAvailability.nightly_rate_cents) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="ct-availability__legend">
        <b>$RATE</b> = Available at COGIC published rate · <b>—</b> = Unavailable
      </p>
      {error ? <p role="alert" className="ct-availability__error">{error}</p> : null}
      <button type="button" disabled={busy} onClick={() => void startBooking()} className="ct-button ct-availability__button">
        {busy ? "Continuing…" : "Continue to COGIC Housing"}
      </button>
      <p className="ct-availability__disclaimer">Clicking or redirecting does not confirm a reservation.</p>
    </section>
  );
}
