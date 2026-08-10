"use client";
import { FormEvent, useEffect, useState } from "react";

const mask = (v: string | null) => (v ? `••••${v.slice(-4)}` : "—");
const input = "min-h-12 w-full rounded bg-white p-3 text-black";

export default function TravelManagementClient() {
  const [data, setData] = useState<any>({
    hotels: [],
    providers: [],
    analytics: {},
    reservations: [],
    airports: [],
    transport: [],
    announcements: [],
  });
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  async function load(query = "") {
    const r = await fetch(
      `/api/owner/travel${query ? `?q=${encodeURIComponent(query)}` : ""}`,
      { cache: "no-store" },
    );
    if (r.ok) setData(await r.json());
    else setError("Unable to load travel administration.");
  }

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
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
        <h2 className="text-2xl font-bold">Travel Providers</h2>
        <p className="mt-2 text-white/60">
          Configuration status only. Live flight/car inventory is not shown unless a provider is
          connected.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {data.providers.map((p: any) => (
            <div key={p.id} className="rounded border border-white/10 p-4">
              <strong>{p.name}</strong>
              <p>{p.configured ? "CONFIGURED" : "NOT CONFIGURED"}</p>
            </div>
          ))}
        </div>
      </section>
      {error ? <p className="text-red-300">{error}</p> : null}
    </div>
  );
}
