"use client";
import { FormEvent, useEffect, useState } from "react";

const mask = (v: string | null) => (v ? `••••${v.slice(-4)}` : "—");
const input = "min-h-12 w-full rounded bg-white p-3 text-black";

export default function TravelManagementClient() {
  const [data, setData] = useState<any>({
    hotels: [],
    providers: [],
    marketplaceReadiness: {},
    analytics: {},
    reservations: [],
    airports: [],
    transport: [],
    announcements: [],
    marketplaceAttempts: [],
    marketplaceQueues: {},
    marketplaceProviderExceptions: {},
  });
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [marketplaceProvider, setMarketplaceProvider] = useState("");
  const [marketplaceKind, setMarketplaceKind] = useState("");
  const [marketplaceStatus, setMarketplaceStatus] = useState("");
  const [marketplaceDateFrom, setMarketplaceDateFrom] = useState("");
  const [marketplaceDateTo, setMarketplaceDateTo] = useState("");
  const [marketplaceStaleOnly, setMarketplaceStaleOnly] = useState(false);

  async function load(query = "") {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (marketplaceProvider) params.set("marketplaceProvider", marketplaceProvider);
    if (marketplaceKind) params.set("marketplaceKind", marketplaceKind);
    if (marketplaceStatus) params.set("marketplaceStatus", marketplaceStatus);
    if (marketplaceDateFrom) params.set("marketplaceDateFrom", marketplaceDateFrom);
    if (marketplaceDateTo) params.set("marketplaceDateTo", marketplaceDateTo);
    if (marketplaceStaleOnly) params.set("marketplaceStaleOnly", "1");
    const r = await fetch(`/api/owner/travel?${params}`, { cache: "no-store" });
    if (r.ok) setData(await r.json());
    else setError("Unable to load travel administration.");
  }

  useEffect(() => {
    void load();
    // Initial owner travel load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function availability(id: number, status: string) {
    await fetch("/api/owner/travel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "availability", id, status }),
    });
    await load(q);
  }

  async function reservation(id: string, action: "verify" | "cancel") {
    const r = await fetch("/api/owner/travel", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (!r.ok) setError((await r.json()).error);
    else await load(q);
  }

  async function createGuide(e: FormEvent<HTMLFormElement>, kind: string) {
    e.preventDefault();
    setError("");
    const form = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch("/api/owner/travel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        ...form,
        published: form.published === "on",
        displayOrder: Number(form.displayOrder || 0),
      }),
    });
    if (!r.ok) setError((await r.json()).error || "Unable to create.");
    else {
      e.currentTarget.reset();
      await load(q);
    }
  }

  async function togglePublish(
    kind: "airport" | "transport" | "announcement",
    id: string,
    published: boolean,
  ) {
    const r = await fetch("/api/owner/travel", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, published: !published }),
    });
    if (!r.ok) setError((await r.json()).error || "Unable to update.");
    else await load(q);
  }

  return (
    <div className="mt-6 grid gap-6">
      <section className="rounded-xl border border-[#d8ab2e]/30 p-5">
        <p className="font-black tracking-[.15em] text-[#d8ab2e]">RESERVATIONS</p>
        <div className="mt-3 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Attendee, email, hotel, confirmation, status, or date"
            className="min-h-12 flex-1 rounded bg-white p-3 text-black"
          />
          <button onClick={() => void load(q)} className="rounded bg-purple-700 px-5">
            Search
          </button>
        </div>
        <div className="mt-5 grid gap-3">
          {data.reservations.map((r: any) => (
            <article key={r.id} className="rounded border border-white/10 p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <strong>{r.hotel_name_snapshot}</strong>
                  <p>
                    {r.attendee_email || r.user_id} · {r.room_type}
                  </p>
                  <p>
                    {r.check_in} – {r.check_out} · {r.reservation_status}
                  </p>
                  <p className="text-white/60">
                    Confirmation {mask(r.confirmation_number)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {r.reservation_status !== "confirmed" ? (
                    <button
                      onClick={() => void reservation(r.id, "verify")}
                      className="min-h-11 rounded bg-green-700 px-3"
                    >
                      Mark verified
                    </button>
                  ) : null}
                  {r.reservation_status !== "canceled" ? (
                    <button
                      onClick={() => void reservation(r.id, "cancel")}
                      className="min-h-11 rounded bg-red-900 px-3"
                    >
                      Mark canceled
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
          {!data.reservations.length ? (
            <p className="text-white/60">No reservations match.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-[#d8ab2e]/30 p-5">
        <p className="font-black tracking-[.15em] text-[#d8ab2e]">
          OFFICIAL COGIC HOUSING DATA
        </p>
        <div className="mt-5 grid gap-5">
          {data.hotels.map((h: any) => (
            <article key={h.id} className="rounded-xl border border-white/10 p-5">
              <h3 className="text-xl font-bold">{h.name}</h3>
              <p className="text-[#d8ab2e]">
                {h.cogic_designation}{" "}
                {h.minimum_nights ? `· ${h.minimum_nights} night minimum` : ""}
              </p>
              <p className="text-sm text-white/60">
                Source: {h.source_type || "Admin"} · Verified:{" "}
                {h.source_verified_at
                  ? new Date(h.source_verified_at).toLocaleString()
                  : "Not recorded"}
              </p>
              {h.travel_hotel_room_types?.map((room: any) => (
                <details key={room.id} className="mt-3 rounded border border-white/10 p-3">
                  <summary>
                    {room.name} · ${(room.nightly_rate_cents / 100).toFixed(0)}
                  </summary>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {room.travel_hotel_nightly_availability?.map((n: any) => (
                      <button
                        key={n.id}
                        onClick={() =>
                          void availability(
                            n.id,
                            n.availability_status === "AVAILABLE"
                              ? "UNAVAILABLE"
                              : "AVAILABLE",
                          )
                        }
                        className={`rounded px-2 py-1 text-xs ${
                          n.availability_status === "AVAILABLE"
                            ? "bg-green-700"
                            : "bg-white/10"
                        }`}
                      >
                        {n.stay_date.slice(5)}{" "}
                        {n.availability_status === "AVAILABLE" ? "$" : "—"}
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[#d8ab2e]/30 p-5">
        <p className="font-black tracking-[.15em] text-[#d8ab2e]">GETTING AROUND</p>
        <p className="mt-2 text-white/65">
          Publish airport and ground transportation guidance shown on /travel/getting-around.
        </p>

        <form
          onSubmit={(e) => void createGuide(e, "airport")}
          className="mt-4 grid gap-2 md:grid-cols-2"
        >
          <input required name="iataCode" placeholder="IATA (STL)" className={input} />
          <input required name="name" placeholder="Airport name" className={input} />
          <textarea name="guidance" placeholder="Guidance" className={`${input} md:col-span-2`} />
          <input name="url" placeholder="URL" className={input} />
          <label className="flex items-center gap-2">
            <input type="checkbox" name="published" defaultChecked /> Published
          </label>
          <button className="rounded bg-purple-700 p-3 md:col-span-2">Create airport</button>
        </form>

        <form
          onSubmit={(e) => void createGuide(e, "transport")}
          className="mt-4 grid gap-2 md:grid-cols-2"
        >
          <input required name="name" placeholder="Option name" className={input} />
          <select name="transportKind" className={input} defaultValue="rideshare">
            <option value="rideshare">Rideshare</option>
            <option value="public_transit">Public transit</option>
            <option value="parking">Parking</option>
            <option value="airport_transfer">Airport transfer</option>
            <option value="official_shuttle">Official shuttle</option>
            <option value="hotel_shuttle">Hotel shuttle</option>
            <option value="charter_bus">Charter bus</option>
            <option value="other">Other</option>
          </select>
          <textarea
            name="description"
            placeholder="Description"
            className={`${input} md:col-span-2`}
          />
          <input name="url" placeholder="URL" className={input} />
          <label className="flex items-center gap-2">
            <input type="checkbox" name="published" defaultChecked /> Published
          </label>
          <button className="rounded bg-purple-700 p-3 md:col-span-2">
            Create transportation option
          </button>
        </form>

        <div className="mt-5 grid gap-3">
          {[...data.airports, ...data.transport].map((row: any) => (
            <article key={row.id} className="rounded border border-white/10 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <strong>{row.name}</strong>
                  <p className="text-sm text-white/60">
                    {row.iata_code || row.kind} · {row.published ? "published" : "unpublished"}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded border border-white/20 px-3 py-1"
                  onClick={() =>
                    void togglePublish(
                      row.iata_code ? "airport" : "transport",
                      row.id,
                      row.published,
                    )
                  }
                >
                  {row.published ? "Unpublish" : "Publish"}
                </button>
              </div>
            </article>
          ))}
          {!data.airports.length && !data.transport.length ? (
            <p className="text-white/60">No Getting Around content yet.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 p-5">
        <h2 className="text-2xl font-bold">Marketplace booking attempts</h2>
        <p className="mt-2 text-white/60">
          Partner redirects never confirm bookings. Confirmation numbers are masked. Stale means still
          non-final after 24 hours — not automatically failed.
        </p>
        <div className="mt-4 grid gap-2 md:grid-cols-3 lg:grid-cols-6">
          {[
            ["booking_started_unconfirmed", "Started / unconfirmed"],
            ["pending_confirmation", "Pending confirmation"],
            ["stale_pending_review", "Stale / pending review"],
            ["missing_reference", "Missing reference"],
            ["failed", "Failed"],
            ["canceled", "Canceled"],
          ].map(([key, label]) => (
            <div key={key} className="rounded border border-white/10 p-3">
              <span className="block text-xs uppercase text-white/50">{label}</span>
              <strong className="text-2xl">
                {Array.isArray(data.marketplaceQueues?.[key]) ? data.marketplaceQueues[key].length : 0}
              </strong>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <div className="rounded border border-white/10 p-3">
            <span className="block text-xs uppercase text-white/50">Providers not configured</span>
            <strong>
              {(data.marketplaceProviderExceptions?.provider_not_configured || []).join(", ") || "None"}
            </strong>
          </div>
          <div className="rounded border border-white/10 p-3">
            <span className="block text-xs uppercase text-white/50">Providers unavailable</span>
            <strong>
              {(data.marketplaceProviderExceptions?.provider_unavailable || []).join(", ") || "None"}
            </strong>
          </div>
          <div className="rounded border border-white/10 p-3">
            <span className="block text-xs uppercase text-white/50">Confirmed (filter list)</span>
            <strong>
              {Array.isArray(data.marketplaceQueues?.confirmed) ? data.marketplaceQueues.confirmed.length : 0}
            </strong>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-4">
          <select
            className={input}
            value={marketplaceProvider}
            onChange={(e) => setMarketplaceProvider(e.target.value)}
          >
            <option value="">All providers</option>
            <option value="expedia-rapid">Expedia Rapid</option>
            <option value="duffel">Duffel</option>
            <option value="amadeus">Amadeus</option>
          </select>
          <select className={input} value={marketplaceKind} onChange={(e) => setMarketplaceKind(e.target.value)}>
            <option value="">All types</option>
            <option value="hotel">Hotel</option>
            <option value="flight">Flight</option>
            <option value="car">Car</option>
          </select>
          <select
            className={input}
            value={marketplaceStatus}
            onChange={(e) => setMarketplaceStatus(e.target.value)}
          >
            <option value="">All states</option>
            {["booking_started", "pending_confirmation", "confirmed", "canceled", "failed"].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-white/80">
            <input
              type="checkbox"
              checked={marketplaceStaleOnly}
              onChange={(e) => setMarketplaceStaleOnly(e.target.checked)}
            />
            Stale only
          </label>
          <input
            type="date"
            className={input}
            value={marketplaceDateFrom}
            onChange={(e) => setMarketplaceDateFrom(e.target.value)}
            aria-label="Marketplace date from"
          />
          <input
            type="date"
            className={input}
            value={marketplaceDateTo}
            onChange={(e) => setMarketplaceDateTo(e.target.value)}
            aria-label="Marketplace date to"
          />
          <button type="button" className="rounded bg-white px-4 font-bold text-black md:col-span-2" onClick={() => void load(q)}>
            Apply filters
          </button>
        </div>
        <div className="mt-4 grid gap-2">
          {(data.marketplaceAttempts || []).map((attempt: any) => (
            <article key={attempt.id} className="rounded border border-white/10 p-3">
              <strong>
                {attempt.kind} · {attempt.provider_key} · {attempt.status}
                {attempt.stale ? " · STALE" : ""}
              </strong>
              <p className="text-sm text-white/60">
                {attempt.attendee_email || attempt.user_id} ·{" "}
                {[attempt.origin_label, attempt.destination_label].filter(Boolean).join(" → ") ||
                  attempt.destination_label ||
                  "Offer"}
              </p>
              <p className="text-sm text-white/60">
                Internal {attempt.id.slice(0, 8)} · Ref {attempt.confirmation_number || "—"} · started{" "}
                {new Date(attempt.started_at).toLocaleString()} · updated{" "}
                {new Date(attempt.updated_at).toLocaleString()}
              </p>
              {attempt.failure_reason ? (
                <p className="text-sm text-red-300">{attempt.failure_reason}</p>
              ) : null}
            </article>
          ))}
          {!data.marketplaceAttempts?.length ? (
            <p className="text-white/60">No marketplace booking attempts match these filters.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 p-5">
        <h2 className="text-2xl font-bold">Provider readiness diagnostics</h2>
        <p className="mt-2 text-white/60">
          Configuration and connectivity status only. Provider API keys and tokens are never shown.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            ["Expedia", data.marketplaceReadiness?.expediaConfigured],
            ["Duffel", data.marketplaceReadiness?.duffelConfigured],
            ["Amadeus", data.marketplaceReadiness?.amadeusConfigured],
          ].map(([label, configured]) => (
            <div key={String(label)} className="rounded border border-white/10 p-4">
              <strong>{label}</strong>
              <p>{configured ? "YES — configured" : "NO — not configured"}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded border border-white/10 p-4">
            <strong>Search operational</strong>
            <p>
              Hotels {data.marketplaceReadiness?.hotelsSearchOperational ? "YES" : "NO"} · Flights{" "}
              {data.marketplaceReadiness?.flightsSearchOperational ? "YES" : "NO"} · Cars{" "}
              {data.marketplaceReadiness?.carsSearchOperational ? "YES" : "NO"}
            </p>
          </div>
          <div className="rounded border border-white/10 p-4">
            <strong>Booking handoff operational</strong>
            <p>{data.marketplaceReadiness?.bookingHandoffOperational ? "YES" : "NO"}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {data.providers.map((p: any) => (
            <div key={p.id} className="rounded border border-white/10 p-4">
              <strong>{p.name}</strong>
              <p>{p.configured ? "CONFIGURED" : "NOT CONFIGURED"}</p>
              <p className="text-sm text-white/60">Connection: {p.connection || "—"}</p>
              <p className="text-sm text-white/60">
                Last check: {p.lastCheckAt ? new Date(p.lastCheckAt).toLocaleString() : "None yet"}
                {p.lastCheckOk == null ? "" : p.lastCheckOk ? " · OK" : " · FAILED"}
              </p>
              {p.lastFailureMessage ? (
                <p className="text-sm text-red-300">{p.lastFailureMessage}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
      {error ? <p className="text-red-300">{error}</p> : null}
    </div>
  );
}
