"use client";

import { useState, type FormEvent } from "react";
import MarketplaceOfferActions from "@/components/travel/MarketplaceOfferActions";
import MarketplaceSearchOutcome from "@/components/travel/MarketplaceSearchOutcome";
import type { MarketplaceHotelOffer, MarketplaceSearchCode } from "@/lib/travel/marketplace/types";

const money = (cents: number | null, currency = "USD") =>
  cents == null
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

export default function MarketplaceHotelSearch() {
  const [destination, setDestination] = useState("St. Louis, MO");
  const [checkIn, setCheckIn] = useState("2026-11-03");
  const [checkOut, setCheckOut] = useState("2026-11-09");
  const [adults, setAdults] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState<MarketplaceSearchCode | null>(null);
  const [reason, setReason] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [offers, setOffers] = useState<MarketplaceHotelOffer[] | null>(null);

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setCode(null);
    setReason("");
    setOffers(null);
    try {
      const response = await fetch("/api/travel/marketplace/hotels/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, checkIn, checkOut, adults }),
      });
      const json = await response.json();
      if (json?.code === "validation_error" || (!response.ok && !json?.reason && !json?.code)) {
        throw new Error(json.error || "Hotel search failed.");
      }
      setCode(json.code ?? (response.ok ? "results" : "provider_not_configured"));
      setProvider(json.provider ?? null);
      setReason(json.reason || json.error || "");
      setOffers(Array.isArray(json.offers) ? json.offers : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hotel search failed.");
      setCode("validation_error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ct-marketplace-lane" aria-label="US hotel marketplace">
      <div className="ct-section-head">
        <div>
          <h2>Search hotels across the US</h2>
          <p>Live marketplace inventory from connected travel partners. Separate from official COGIC negotiated rates.</p>
        </div>
      </div>

      <form className="ct-marketplace-form" onSubmit={onSearch}>
        <div className="ct-marketplace-grid">
          <label className="ct-span-2">
            Destination
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="City or airport (US)"
              required
              autoComplete="off"
            />
          </label>
          <label>
            Check-in
            <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
          </label>
          <label>
            Check-out
            <input
              type="date"
              value={checkOut}
              min={checkIn || undefined}
              onChange={(e) => setCheckOut(e.target.value)}
              required
            />
          </label>
          <label>
            Adults
            <select value={adults} onChange={(e) => setAdults(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" className="ct-search-submit" disabled={busy}>
          {busy ? "Searching…" : "Search US Hotels"}
        </button>
      </form>

      {error ? (
        <p role="alert" className="ct-honest-hint">
          {error}
        </p>
      ) : null}

      {offers && code === "results" && offers.length ? (
        <div className="ct-marketplace-results">
          <p className="ct-honest-hint">
            Showing {offers.length} live offer{offers.length === 1 ? "" : "s"}
            {provider ? ` via ${provider}` : ""}. Selecting an offer does not confirm a reservation until you
            complete partner booking and save a confirmation on My Trip.
          </p>
          <ul className="ct-marketplace-offer-list">
            {offers.map((offer) => (
              <li key={offer.id} className="ct-marketplace-offer">
                <div>
                  <strong>{offer.name}</strong>
                  <p>
                    {[offer.city, offer.state].filter(Boolean).join(", ") || "United States"}
                    {offer.roomName ? ` · ${offer.roomName}` : ""}
                  </p>
                  <p>
                    {offer.nightlyRateCents != null
                      ? `${money(offer.nightlyRateCents, offer.currency)} / night est.`
                      : "Rate on offer"}
                    {offer.totalRateCents != null
                      ? ` · Total ${money(offer.totalRateCents, offer.currency)}`
                      : ""}
                  </p>
                </div>
                <MarketplaceOfferActions
                  kind="hotel"
                  offer={offer as unknown as Record<string, unknown>}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  label={offer.bookingUrl ? "Continue booking" : "Start booking on My Trip"}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : offers ? (
        <MarketplaceSearchOutcome code={code} reason={reason} showOfficialHotelsLink />
      ) : (
        <p className="ct-honest-hint">
          Search any US city. Live rates appear only when Expedia Rapid or Enterprise Amadeus is connected on the
          server. Official COGIC hotels stay available above.
        </p>
      )}
    </section>
  );
}
