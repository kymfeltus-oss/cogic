"use client";

import { useState, type FormEvent } from "react";
import MarketplaceOfferActions from "@/components/travel/MarketplaceOfferActions";
import MarketplaceSearchOutcome from "@/components/travel/MarketplaceSearchOutcome";
import type { MarketplaceFlightOffer, MarketplaceSearchCode } from "@/lib/travel/marketplace/types";

type TripType = "roundtrip" | "oneway";

const money = (cents: number | null, currency = "USD") =>
  cents == null
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

export default function FlightSearchPanel() {
  const [tripType, setTripType] = useState<TripType>("roundtrip");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("STL");
  const [depart, setDepart] = useState("2026-11-08");
  const [ret, setRet] = useState("2026-11-15");
  const [travelers, setTravelers] = useState(1);
  const [cabin, setCabin] = useState("Economy");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState<MarketplaceSearchCode | null>(null);
  const [reason, setReason] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [offers, setOffers] = useState<MarketplaceFlightOffer[] | null>(null);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setCode(null);
    setReason("");
    setOffers(null);
    try {
      const response = await fetch("/api/travel/marketplace/flights/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: from,
          destination: to,
          departDate: depart,
          returnDate: tripType === "roundtrip" ? ret : null,
          adults: travelers,
          cabin,
        }),
      });
      const json = await response.json();
      if (json?.code === "validation_error" || (!response.ok && !json?.reason && !json?.code)) {
        throw new Error(json.error || "Flight search failed.");
      }
      setCode(json.code ?? (response.ok ? "results" : "provider_not_configured"));
      setProvider(json.provider ?? null);
      setReason(json.reason || json.error || "");
      setOffers(Array.isArray(json.offers) ? json.offers : []);
      void fetch("/api/travel/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "travel_flight_search_started",
          properties: { tripType, cabin, travelers, from, to },
        }),
      }).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Flight search failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ct-tab-panel-inner">
      <div className="ct-section-head">
        <div>
          <h2>Flights</h2>
          <p>Search flights across the US. Defaults to St. Louis (STL) for Convocation, but any US airport works.</p>
        </div>
      </div>

      <form className="ct-marketplace-form" onSubmit={onSearch}>
        <div className="ct-trip-toggle" role="group" aria-label="Trip type">
          <button
            type="button"
            className={tripType === "roundtrip" ? "active" : undefined}
            onClick={() => setTripType("roundtrip")}
          >
            Round trip
          </button>
          <button
            type="button"
            className={tripType === "oneway" ? "active" : undefined}
            onClick={() => setTripType("oneway")}
          >
            One way
          </button>
        </div>

        <div className="ct-marketplace-grid">
          <label>
            From
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value.toUpperCase())}
              placeholder="Airport code (ATL)"
              maxLength={3}
              required
              autoComplete="off"
            />
          </label>
          <label>
            To
            <input
              value={to}
              onChange={(e) => setTo(e.target.value.toUpperCase())}
              placeholder="Airport code (STL)"
              maxLength={3}
              required
              autoComplete="off"
            />
          </label>
          <label>
            Depart
            <input type="date" value={depart} onChange={(e) => setDepart(e.target.value)} required />
          </label>
          {tripType === "roundtrip" ? (
            <label>
              Return
              <input type="date" value={ret} onChange={(e) => setRet(e.target.value)} required />
            </label>
          ) : (
            <label className="ct-field-spacer" aria-hidden="true">
              <span>&nbsp;</span>
              <span className="ct-field-spacer-box" />
            </label>
          )}
          <label>
            Travelers
            <select value={travelers} onChange={(e) => setTravelers(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} traveler{n === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cabin
            <select value={cabin} onChange={(e) => setCabin(e.target.value)}>
              <option>Economy</option>
              <option>Premium Economy</option>
              <option>Business</option>
              <option>First</option>
            </select>
          </label>
        </div>

        <button type="submit" className="ct-search-submit" disabled={busy}>
          {busy ? "Searching…" : "Search Flights"}
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
            {provider ? ` via ${provider}` : ""}. Checkout securely in-app — supplier booking references are
            written automatically after payment.
          </p>
          <ul className="ct-marketplace-offer-list">
            {offers.map((offer) => (
              <li key={offer.id} className="ct-marketplace-offer">
                <div>
                  <strong>
                    {offer.airline || "Flight"} {offer.flightNumber || ""}
                  </strong>
                  <p>
                    {offer.origin} → {offer.destination}
                    {offer.stops ? ` · ${offer.stops} stop${offer.stops === 1 ? "" : "s"}` : " · Nonstop"}
                  </p>
                  <p>
                    {offer.departAt ? new Date(offer.departAt).toLocaleString() : "Depart TBD"}
                    {" · "}
                    {money(offer.totalFareCents, offer.currency)}
                  </p>
                </div>
                <MarketplaceOfferActions
                  kind="flight"
                  offer={offer as unknown as Record<string, unknown>}
                  label="Checkout securely"
                />
              </li>
            ))}
          </ul>
        </div>
      ) : offers ? (
        <MarketplaceSearchOutcome code={code} reason={reason} />
      ) : (
        <p className="ct-honest-hint">
          Enter US airport codes and search. Live fares appear only when Duffel is connected for checkout.
        </p>
      )}
    </div>
  );
}
