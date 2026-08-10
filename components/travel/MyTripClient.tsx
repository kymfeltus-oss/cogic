"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Kind = "flight" | "car";

const fields: { [K in Kind]: string[] } = {
  flight: ["airline", "flight_number", "origin", "destination", "departure_at", "arrival_at", "confirmation_number"],
  car: ["company", "confirmation_number", "pickup_at", "dropoff_at"],
};

const labels: Record<string, string> = {
  confirmation_number: "Confirmation number",
  airline: "Airline",
  flight_number: "Flight number",
  origin: "Origin",
  destination: "Destination",
  departure_at: "Departure",
  arrival_at: "Arrival",
  company: "Rental company",
  pickup_at: "Pickup",
  dropoff_at: "Drop-off",
};

const nights = (a: string, b: string) =>
  Math.round((new Date(`${b}T12:00:00Z`).valueOf() - new Date(`${a}T12:00:00Z`).valueOf()) / 86400000);

const confirmLabel = (v: string | null | undefined) =>
  !v ? "Not provided" : v.startsWith("••••") ? v : `••••${v.slice(-4)}`;

export default function MyTripClient() {
  const [data, setData] = useState<any>({ hotels: [], flights: [], cars: [] });
  const [hotel, setHotel] = useState<any>({ reservations: [], primary: null, journey: null });
  const [attempts, setAttempts] = useState<any[]>([]);
  const [kind, setKind] = useState<Kind | null>(null);
  const [hotelForm, setHotelForm] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recheckMessage, setRecheckMessage] = useState("");

  async function load() {
    const [a, b, c] = await Promise.all([
      fetch("/api/travel/itinerary", { cache: "no-store" }),
      fetch("/api/travel/reservations", { cache: "no-store" }),
      fetch(
        "/api/travel/marketplace/booking/attempts?status=booking_started,pending_confirmation,failed,canceled",
        { cache: "no-store" },
      ),
    ]);
    if (a.ok) setData(await a.json());
    if (b.ok) setHotel(await b.json());
    if (c.ok) {
      const json = await c.json();
      setAttempts(json.attempts || []);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveHotel(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch("/api/travel/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        journeyId: hotel.journey?.id,
        hotelId: hotel.journey?.hotel_id,
        ...form,
      }),
    });
    if (!r.ok) setError((await r.json()).error);
    else {
      setHotelForm(false);
      await load();
    }
    setBusy(false);
  }

  async function cancel(id: string) {
    if (!confirm("Mark this reservation canceled? The history will be retained.")) return;
    await fetch("/api/travel/reservations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "cancel" }),
    });
    await load();
  }

  async function saveItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!kind) return;
    setBusy(true);
    const form = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch("/api/travel/itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...form }),
    });
    if (!r.ok) setError((await r.json()).error);
    else {
      setKind(null);
      await load();
    }
    setBusy(false);
  }

  async function confirmMarketplace(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!confirmingId) return;
    setBusy(true);
    setError("");
    const form = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch("/api/travel/marketplace/booking/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptId: confirmingId,
        confirmationNumber: form.confirmationNumber,
        notes: form.notes || null,
      }),
    });
    if (!r.ok) setError((await r.json()).error);
    else {
      setConfirmingId(null);
      await load();
    }
    setBusy(false);
  }

  async function cancelAttempt(id: string) {
    if (!confirm("Cancel this marketplace booking attempt?")) return;
    await fetch("/api/travel/marketplace/booking/attempts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId: id, action: "cancel" }),
    });
    await load();
  }

  async function recheckAttempt(id: string) {
    setBusy(true);
    setError("");
    setRecheckMessage("");
    const r = await fetch("/api/travel/marketplace/booking/recheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId: id }),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) setError(json.error || "Unable to check booking status.");
    else {
      setRecheckMessage(json.message || "Status checked.");
      await load();
    }
    setBusy(false);
  }

  const history = (hotel.reservations ?? []).filter((r: any) => !hotel.primary || r.id !== hotel.primary.id);
  const pendingMarketplace = attempts.filter((a) =>
    ["booking_started", "pending_confirmation"].includes(a.status),
  );
  const closedMarketplace = attempts.filter((a) => ["failed", "canceled"].includes(a.status));

  return (
    <div>
      {pendingMarketplace.length ? (
        <section className="mt-8 rounded-3xl border border-amber-300/30 bg-amber-300/10 p-6">
          <h2 className="text-3xl font-bold">Marketplace bookings pending confirmation</h2>
          <p className="mt-2 text-white/70">
            Pending confirmation is not booked. A partner redirect never confirms a reservation. Add the real
            confirmation number after you complete booking, or check status if you already finished with the partner.
          </p>
          {recheckMessage ? <p className="mt-3 text-amber-100">{recheckMessage}</p> : null}
          <div className="mt-5 grid gap-4">
            {pendingMarketplace.map((attempt) => (
              <article key={attempt.id} className="rounded-2xl border border-white/15 bg-black/20 p-4">
                <p className="text-sm uppercase tracking-wide text-amber-200">
                  {String(attempt.status).replace(/_/g, " ")} — action required
                </p>
                <h3 className="mt-1 text-xl font-bold">
                  {attempt.kind.toUpperCase()} · {attempt.provider_key}
                </h3>
                <p className="mt-2 text-white/75">
                  {[attempt.origin_label, attempt.destination_label].filter(Boolean).join(" → ") ||
                    attempt.destination_label ||
                    "Marketplace offer"}
                </p>
                {(attempt.start_at || attempt.end_at) && (
                  <p className="mt-1 text-white/60">
                    {attempt.start_at ? new Date(attempt.start_at).toLocaleString() : "Start TBD"}
                    {attempt.end_at ? ` – ${new Date(attempt.end_at).toLocaleString()}` : ""}
                  </p>
                )}
                <p className="mt-2 text-sm text-white/55">
                  Next: finish partner booking if needed, then add your confirmation reference here.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="min-h-12 rounded-xl bg-[#d8ab2e] px-5 font-bold text-black"
                    onClick={() => setConfirmingId(attempt.id)}
                  >
                    Add confirmation
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="min-h-12 rounded-xl border border-white/30 px-5"
                    onClick={() => void recheckAttempt(attempt.id)}
                  >
                    Check booking status
                  </button>
                  {attempt.partner_booking_url ? (
                    <a
                      href={attempt.partner_booking_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-12 items-center underline"
                    >
                      Reopen partner booking
                    </a>
                  ) : null}
                  <button type="button" className="min-h-12 text-red-300 underline" onClick={() => void cancelAttempt(attempt.id)}>
                    Cancel attempt
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {closedMarketplace.length ? (
        <section className="mt-8 rounded-3xl border border-white/15 bg-white/[.04] p-6">
          <h2 className="text-2xl font-bold">Marketplace attempts — canceled or failed</h2>
          <div className="mt-4 grid gap-3">
            {closedMarketplace.map((attempt) => (
              <article key={attempt.id} className="rounded-2xl border border-white/10 p-4">
                <p className="text-sm uppercase tracking-wide text-white/50">
                  {String(attempt.status).replace(/_/g, " ")}
                </p>
                <strong>
                  {attempt.kind.toUpperCase()} · {attempt.provider_key}
                </strong>
                <p className="text-white/70">
                  {[attempt.origin_label, attempt.destination_label].filter(Boolean).join(" → ") ||
                    attempt.destination_label ||
                    "Marketplace offer"}
                </p>
                {attempt.failure_reason ? <p className="text-red-300">{attempt.failure_reason}</p> : null}
                <p className="mt-2 text-sm text-white/55">No further action required for this attempt.</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {confirmingId ? (
        <form onSubmit={confirmMarketplace} className="mt-6 rounded-3xl border border-[#d8ab2e]/30 bg-[#111126] p-6">
          <h2 className="text-2xl font-bold">Confirm marketplace booking</h2>
          <p className="mt-2 text-white/65">Only save after you have a real confirmation or booking reference.</p>
          <label className="mt-5 block">
            Confirmation / booking reference
            <input
              name="confirmationNumber"
              required
              minLength={3}
              className="mt-2 min-h-14 w-full rounded-xl bg-white p-3 text-black"
            />
          </label>
          <label className="mt-4 block">
            Notes (optional)
            <input name="notes" className="mt-2 min-h-14 w-full rounded-xl bg-white p-3 text-black" />
          </label>
          {error ? <p className="mt-4 text-red-300">{error}</p> : null}
          <div className="mt-5 flex gap-3">
            <button disabled={busy} className="min-h-12 rounded-xl bg-white px-5 font-bold text-black">
              Save confirmed booking
            </button>
            <button type="button" onClick={() => setConfirmingId(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <section className="mt-8 rounded-3xl border border-white/15 bg-white/[.06] p-6">
        <h2 className="text-3xl font-bold">Your Stay</h2>
        <p className="mt-2 text-white/60">Official COGIC lodging and confirmed marketplace hotels.</p>
        {hotel.primary ? (
          <div className="mt-5">
            <p className="font-black text-green-300">✓ CONFIRMED</p>
            <h3 className="mt-2 text-2xl font-bold">{hotel.primary.hotel_name_snapshot}</h3>
            <p className="mt-2 text-lg">
              {hotel.primary.room_type} · {hotel.primary.check_in} – {hotel.primary.check_out} ·{" "}
              {nights(hotel.primary.check_in, hotel.primary.check_out)} nights
            </p>
            <p className="mt-2 text-white/65">Confirmation {confirmLabel(hotel.primary.confirmation_number)}</p>
            {hotel.primary.reservation_status !== "canceled" ? (
              <button
                type="button"
                onClick={() => void cancel(hotel.primary.id)}
                className="mt-4 min-h-12 text-red-300 underline"
              >
                Mark canceled
              </button>
            ) : null}
          </div>
        ) : hotel.journey ? (
          <div className="mt-5 rounded-2xl bg-amber-300/10 p-5">
            <h3 className="text-2xl font-bold">Did you complete your hotel reservation?</h3>
            <p className="mt-2 text-white/70">A housing booking journey was started. A redirect is not a confirmation.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setHotelForm(true)}
                className="min-h-12 rounded-xl bg-[#d8ab2e] px-5 font-bold text-black"
              >
                Yes, Add My Reservation
              </button>
              <Link href="/travel/hotels" className="inline-flex min-h-12 items-center px-5 underline">
                Not yet — browse hotels
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <p className="text-xl text-white/70">No hotel reservation added yet.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/travel/hotels"
                className="inline-flex min-h-12 items-center rounded-xl bg-[#5c24b5] px-5 font-bold"
              >
                Find an Official COGIC Hotel
              </Link>
              <button onClick={() => setHotelForm(true)} className="min-h-12 px-5 underline">
                Already booked? Add My Reservation
              </button>
            </div>
          </div>
        )}
        {history.map((r: any) => (
          <article key={r.id} className="mt-5 border-t border-white/10 pt-4">
            <div className="flex flex-wrap justify-between">
              <div>
                <strong>{r.hotel_name_snapshot}</strong>
                <p>
                  {r.reservation_status} · {r.check_in} – {r.check_out}
                  {r.booking_source === "marketplace" ? " · marketplace" : ""}
                </p>
                <p className="text-white/60">Confirmation {confirmLabel(r.confirmation_number)}</p>
              </div>
              {r.reservation_status !== "canceled" ? (
                <button onClick={() => void cancel(r.id)} className="min-h-12 text-red-300 underline">
                  Mark canceled
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      {hotelForm ? (
        <form onSubmit={saveHotel} className="mt-6 rounded-3xl border border-[#d8ab2e]/30 bg-[#111126] p-6">
          <h2 className="text-2xl font-bold">Add My Actual Reservation</h2>
          <p className="mt-2 text-white/65">Only save this form after you have received a real confirmation number.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {(
              [
                ["hotelName", "Hotel", hotel.journey?.travel_hotels?.name || ""],
                ["roomType", "Room type", hotel.journey?.travel_hotel_room_types?.name || ""],
                ["checkIn", "Check-in", hotel.journey?.selected_check_in || ""],
                ["checkOut", "Check-out", hotel.journey?.selected_check_out || ""],
                ["confirmationNumber", "Confirmation number", ""],
                ["guestCount", "Number of guests", ""],
                ["nightlyRate", "Booked nightly rate (optional)", ""],
                ["notes", "Notes (optional)", ""],
              ] as const
            ).map(([name, label, value]) => (
              <label key={name}>
                {label}
                <input
                  name={name}
                  defaultValue={value}
                  required={!["guestCount", "nightlyRate", "notes"].includes(name)}
                  type={
                    name === "checkIn" || name === "checkOut"
                      ? "date"
                      : name === "guestCount" || name === "nightlyRate"
                        ? "number"
                        : "text"
                  }
                  className="mt-2 min-h-14 w-full rounded-xl bg-white p-3 text-black"
                />
              </label>
            ))}
          </div>
          {error ? <p className="mt-4 text-red-300">{error}</p> : null}
          <div className="mt-5 flex gap-3">
            <button disabled={busy} className="min-h-12 rounded-xl bg-white px-5 font-bold text-black">
              Save Confirmed Reservation
            </button>
            <button type="button" onClick={() => setHotelForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {(["flight", "car"] as Kind[]).map((k) => (
          <section key={k} className="rounded-3xl border border-white/15 bg-white/[.06] p-6">
            <h2 className="text-2xl font-bold">{k === "car" ? "Transportation" : "Flight"}</h2>
            {data[`${k}s`].map((x: any) => (
              <p key={x.id} className="mt-3">
                {x.airline || x.company} · {x.flight_number || x.confirmation_number || "Added"}
              </p>
            ))}
            {!data[`${k}s`].length ? <p className="mt-3 text-white/60">Not Added</p> : null}
            <button onClick={() => setKind(k)} className="mt-5 min-h-12 rounded-xl bg-[#5c24b5] px-5 font-bold">
              Add {k === "car" ? "Transportation" : "Flight"}
            </button>
          </section>
        ))}
      </div>

      {kind ? (
        <form onSubmit={saveItem} className="mt-6 rounded-3xl border border-white/15 p-6">
          <h2 className="text-2xl font-bold">Add {kind}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {fields[kind].map((f) => (
              <label key={f}>
                {labels[f]}
                <input
                  name={f}
                  required={!["confirmation_number"].includes(f)}
                  type={f.includes("_at") ? "datetime-local" : "text"}
                  className="mt-2 min-h-14 w-full rounded-xl bg-white p-3 text-black"
                />
              </label>
            ))}
          </div>
          <button disabled={busy} className="mt-5 min-h-12 rounded-xl bg-white px-5 font-bold text-black">
            Save
          </button>
        </form>
      ) : null}
    </div>
  );
}
