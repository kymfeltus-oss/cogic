"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Kind = "flight" | "car";

const fields: { [K in Kind]: string[] } = {
  flight: ["airline", "flight_number", "origin", "destination", "departure_at", "arrival_at"],
  car: ["company", "pickup_at", "dropoff_at"],
};

const labels: Record<string, string> = {
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
  !v ? "Pending supplier code" : v.startsWith("••••") ? v : `••••${v.slice(-4)}`;

export default function MyTripClient() {
  const [data, setData] = useState<any>({ hotels: [], flights: [], cars: [] });
  const [hotel, setHotel] = useState<any>({ reservations: [], primary: null, journey: null });
  const [attempts, setAttempts] = useState<any[]>([]);
  const [supplierUpdates, setSupplierUpdates] = useState<any[]>([]);
  const [kind, setKind] = useState<Kind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [a, b, c, d] = await Promise.all([
      fetch("/api/travel/itinerary", { cache: "no-store" }),
      fetch("/api/travel/reservations", { cache: "no-store" }),
      fetch(
        "/api/travel/marketplace/booking/attempts?status=DRAFT,PAYMENT_PENDING,SUPPLIER_SUBMITTED,FAILED,REFUNDED,CONFIRMED",
        { cache: "no-store" },
      ),
      fetch("/api/travel/supplier-updates", { cache: "no-store" }),
    ]);
    if (a.ok) setData(await a.json());
    if (b.ok) setHotel(await b.json());
    if (c.ok) {
      const json = await c.json();
      setAttempts(json.attempts || []);
    }
    if (d.ok) {
      const json = await d.json();
      setSupplierUpdates(json.events || []);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 20000);
    return () => window.clearInterval(timer);
  }, []);

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
    setError("");
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

  async function cancelAttempt(id: string) {
    if (!confirm("Cancel this marketplace booking attempt?")) return;
    await fetch("/api/travel/marketplace/booking/attempts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId: id, action: "cancel" }),
    });
    await load();
  }

  const history = (hotel.reservations ?? []).filter((r: any) => !hotel.primary || r.id !== hotel.primary.id);
  const pendingMarketplace = attempts.filter((a) =>
    ["DRAFT", "PAYMENT_PENDING", "SUPPLIER_SUBMITTED"].includes(a.status),
  );
  const closedMarketplace = attempts.filter((a) => ["FAILED", "REFUNDED"].includes(a.status));
  const confirmedMarketplace = attempts.filter((a) => a.status === "CONFIRMED");

  return (
    <div>
      {error ? <p className="mt-6 text-red-300">{error}</p> : null}

      {supplierUpdates.length ? (
        <section className="mt-8 rounded-3xl border border-cyan-300/30 bg-cyan-300/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-bold">Supplier updates</h2>
            <button type="button" className="underline" onClick={() => void load()}>
              Refresh now
            </button>
          </div>
          <p className="mt-2 text-white/70">
            Live change notices from Expedia Rapid / Duffel applied to your trip ledger.
          </p>
          <div className="mt-5 grid gap-3">
            {supplierUpdates.map((event) => (
              <article key={event.id} className="rounded-2xl border border-white/15 bg-black/20 p-4">
                <p className="text-sm uppercase tracking-wide text-cyan-100">
                  {String(event.event_type || "update").replace(/_/g, " ")} · {event.provider_key}
                </p>
                <p className="mt-1 text-lg text-white">{event.summary}</p>
                <p className="mt-2 text-sm text-white/55">
                  {new Date(event.created_at).toLocaleString()}
                  {event.applied ? " · applied to your trip" : " · recorded"}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {pendingMarketplace.length ? (
        <section className="mt-8 rounded-3xl border border-amber-300/30 bg-amber-300/10 p-6">
          <h2 className="text-3xl font-bold">Marketplace checkout in progress</h2>
          <p className="mt-2 text-white/70">
            Finish payment and supplier capture inside secure in-app checkout. Partner tabs and typed
            confirmation codes are retired.
          </p>
          <div className="mt-5 grid gap-4">
            {pendingMarketplace.map((attempt) => {
              const continueHref =
                attempt.status === "SUPPLIER_SUBMITTED"
                  ? `/travel/confirmation?attemptId=${encodeURIComponent(attempt.id)}`
                  : `/travel/checkout/continue?attemptId=${encodeURIComponent(attempt.id)}`;
              return (
                <article key={attempt.id} className="rounded-2xl border border-white/15 bg-black/20 p-4">
                  <p className="text-sm uppercase tracking-wide text-amber-200">
                    {String(attempt.status).replace(/_/g, " ")}
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
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={continueHref}
                      className="inline-flex min-h-12 items-center rounded-xl bg-[#d8ab2e] px-5 font-bold text-black"
                    >
                      {attempt.status === "SUPPLIER_SUBMITTED"
                        ? "View confirmation status"
                        : "Continue secure checkout"}
                    </Link>
                    <button
                      type="button"
                      className="min-h-12 text-red-300 underline"
                      onClick={() => void cancelAttempt(attempt.id)}
                    >
                      Cancel attempt
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {confirmedMarketplace.length ? (
        <section className="mt-8 rounded-3xl border border-emerald-300/30 bg-emerald-300/10 p-6">
          <h2 className="text-2xl font-bold">Confirmed marketplace bookings</h2>
          <div className="mt-4 grid gap-3">
            {confirmedMarketplace.map((attempt) => (
              <article key={attempt.id} className="rounded-2xl border border-white/10 p-4">
                <p className="text-sm uppercase tracking-wide text-emerald-200">CONFIRMED</p>
                <strong>
                  {attempt.kind.toUpperCase()} · {attempt.provider_key}
                </strong>
                <p className="text-white/70">
                  {[attempt.origin_label, attempt.destination_label].filter(Boolean).join(" → ") ||
                    attempt.destination_label ||
                    "Marketplace offer"}
                </p>
                <Link
                  href={`/travel/confirmation?attemptId=${encodeURIComponent(attempt.id)}`}
                  className="mt-3 inline-flex min-h-12 items-center underline"
                >
                  Open receipt &amp; supplier code
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {closedMarketplace.length ? (
        <section className="mt-8 rounded-3xl border border-white/15 bg-white/[.04] p-6">
          <h2 className="text-2xl font-bold">Marketplace attempts — failed or refunded</h2>
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
                <p className="mt-2 text-sm text-white/55">Search again to start a new in-app checkout.</p>
                <Link href="/travel" className="mt-3 inline-flex min-h-12 items-center underline">
                  Return to Travel Hub
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8 rounded-3xl border border-white/15 bg-white/[.06] p-6">
        <h2 className="text-3xl font-bold">Your Stay</h2>
        <p className="mt-2 text-white/60">
          Confirmed stays are populated via marketplace checkouts and housing-completed registration stays
          only. Official COGIC hotels in this app are browse-and-request interest — not confirmed in-app.
          Supplier codes are never typed in by hand.
        </p>
        {hotel.primary ? (
          <div className="mt-5">
            <p className="font-black text-green-300">✓ CONFIRMED</p>
            <p className="mt-1 text-sm uppercase tracking-wide text-white/55">
              {hotel.primary.booking_source === "marketplace"
                ? "Marketplace checkout"
                : "Housing-completed registration stay"}
            </p>
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
            <h3 className="text-2xl font-bold">Official housing interest saved</h3>
            <p className="mt-2 text-white/70">
              Official COGIC hotels are browse-and-request only in this app — there is no in-app payment or
              CRS confirmation for negotiated housing. Contact COGIC Housing to complete your stay, or book a
              marketplace hotel through secure checkout.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={
                  hotel.journey?.travel_hotels?.slug
                    ? `/travel/hotels/${hotel.journey.travel_hotels.slug}`
                    : "/travel/hotels"
                }
                className="inline-flex min-h-12 items-center rounded-xl bg-[#d8ab2e] px-5 font-bold text-black"
              >
                View saved hotel
              </Link>
              <a
                href="mailto:housing@cogic.org"
                className="inline-flex min-h-12 items-center rounded-xl bg-white/10 px-5 font-bold"
              >
                Contact COGIC Housing
              </a>
              <Link href="/travel" className="inline-flex min-h-12 items-center px-5 underline">
                Search marketplace hotels
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <p className="text-xl text-white/70">
              No confirmed stay yet from marketplace checkout or housing-completed registration.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/travel/hotels"
                className="inline-flex min-h-12 items-center rounded-xl bg-[#5c24b5] px-5 font-bold"
              >
                Browse official COGIC hotels
              </Link>
              <Link href="/travel" className="inline-flex min-h-12 items-center px-5 underline">
                Search marketplace hotels
              </Link>
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
                  {r.booking_source === "marketplace"
                    ? " · marketplace checkout"
                    : " · housing-completed registration"}
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

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {(["flight", "car"] as Kind[]).map((k) => (
          <section key={k} className="rounded-3xl border border-white/15 bg-white/[.06] p-6">
            <h2 className="text-2xl font-bold">{k === "car" ? "Transportation" : "Flight"}</h2>
            <p className="mt-2 text-sm text-white/55">
              Confirmed marketplace {k === "car" ? "cars" : "flights"} appear automatically. You can also note
              personal schedule details (no confirmation codes).
            </p>
            {data[`${k}s`].map((x: any) => (
              <p key={x.id} className="mt-3">
                {x.airline || x.company} · {x.flight_number || "Scheduled"}
                {x.confirmation_number ? ` · ${confirmLabel(x.confirmation_number)}` : ""}
              </p>
            ))}
            {!data[`${k}s`].length ? <p className="mt-3 text-white/60">Not Added</p> : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={k === "car" ? "/travel/cars" : "/travel/flights"}
                className="inline-flex min-h-12 items-center rounded-xl bg-[#d8ab2e] px-5 font-bold text-black"
              >
                Checkout {k === "car" ? "cars" : "flights"}
              </Link>
              <button
                type="button"
                onClick={() => setKind(k)}
                className="min-h-12 rounded-xl bg-[#5c24b5] px-5 font-bold"
              >
                Add schedule note
              </button>
            </div>
          </section>
        ))}
      </div>

      {kind ? (
        <form onSubmit={saveItem} className="mt-6 rounded-3xl border border-white/15 p-6">
          <h2 className="text-2xl font-bold">Add {kind} schedule note</h2>
          <p className="mt-2 text-white/60">
            Personal itinerary notes only. Marketplace reservations are confirmed through secure checkout — do not
            enter supplier confirmation codes here.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {fields[kind].map((f) => (
              <label key={f}>
                {labels[f]}
                <input
                  name={f}
                  required
                  type={f.includes("_at") ? "datetime-local" : "text"}
                  className="mt-2 min-h-14 w-full rounded-xl bg-white p-3 text-black"
                />
              </label>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button disabled={busy} className="min-h-12 rounded-xl bg-white px-5 font-bold text-black">
              Save schedule note
            </button>
            <button type="button" onClick={() => setKind(null)} className="min-h-12 px-5 underline">
              Close
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
