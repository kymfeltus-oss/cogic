"use client";

import { useState, type FormEvent } from "react";
import MarketplaceOfferActions from "@/components/travel/MarketplaceOfferActions";
import MarketplaceSearchOutcome from "@/components/travel/MarketplaceSearchOutcome";
import type { MarketplaceCarOffer, MarketplaceSearchCode } from "@/lib/travel/marketplace/types";

const money = (cents: number | null, currency = "USD") =>
  cents == null
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

export default function RentalCarSearchPanel() {
  const [pickupLocation, setPickupLocation] = useState("St. Louis, Missouri");
  const [differentDropoff, setDifferentDropoff] = useState(false);
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [pickupDate, setPickupDate] = useState("2026-11-08");
  const [pickupTime, setPickupTime] = useState("10:00");
  const [dropoffDate, setDropoffDate] = useState("2026-11-15");
  const [dropoffTime, setDropoffTime] = useState("10:00");
  const [driverAge, setDriverAge] = useState("25+");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState<MarketplaceSearchCode | null>(null);
  const [reason, setReason] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [offers, setOffers] = useState<MarketplaceCarOffer[] | null>(null);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setCode(null);
    setReason("");
    setOffers(null);
    try {
      const response = await fetch("/api/travel/marketplace/cars/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupLocation,
          dropoffLocation: differentDropoff ? dropoffLocation : pickupLocation,
          pickupDate,
          pickupTime,
          dropoffDate,
          dropoffTime,
          driverAge,
        }),
      });
      const json = await response.json();
      if (json?.code === "validation_error" || (!response.ok && !json?.reason && !json?.code)) {
        throw new Error(json.error || "Car search failed.");
      }
      setCode(json.code ?? (response.ok ? "results" : "provider_not_configured"));
      setProvider(json.provider ?? null);
      setReason(json.reason || json.error || "");
      setOffers(Array.isArray(json.offers) ? json.offers : []);
      void fetch("/api/travel/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "travel_car_search_started",
          properties: { pickupLocation, differentDropoff, driverAge },
        }),
      }).catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Car search failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ct-tab-panel-inner">
      <div className="ct-section-head">
        <div>
          <h2>Rental Cars</h2>
          <p>Search rental cars across the US for Convocation week or any trip dates.</p>
        </div>
      </div>

      <form className="ct-marketplace-form" onSubmit={onSearch}>
        <div className="ct-marketplace-grid">
          <label className="ct-span-2">
            Pick-up location
            <input
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              placeholder="City or airport (US)"
              required
              autoComplete="off"
            />
          </label>
          <label>
            Pick-up date
            <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} required />
          </label>
          <label>
            Pick-up time
            <input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} required />
          </label>
          <label>
            Drop-off date
            <input type="date" value={dropoffDate} onChange={(e) => setDropoffDate(e.target.value)} required />
          </label>
          <label>
            Drop-off time
            <input type="time" value={dropoffTime} onChange={(e) => setDropoffTime(e.target.value)} required />
          </label>
          <label className="ct-span-2 ct-check-row">
            <input
              type="checkbox"
              checked={differentDropoff}
              onChange={(e) => setDifferentDropoff(e.target.checked)}
            />
            Return car to different location
          </label>
          {differentDropoff ? (
            <label className="ct-span-2">
              Drop-off location
              <input
                value={dropoffLocation}
                onChange={(e) => setDropoffLocation(e.target.value)}
                placeholder="City or airport"
                required
                autoComplete="off"
              />
            </label>
          ) : null}
          <label>
            Driver age
            <select value={driverAge} onChange={(e) => setDriverAge(e.target.value)}>
              <option value="25+">25+</option>
              <option value="21-24">21–24</option>
              <option value="18-20">18–20</option>
            </select>
          </label>
        </div>

        <button type="submit" className="ct-search-submit" disabled={busy}>
          {busy ? "Searching…" : "Search Rental Cars"}
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
            {provider ? ` via ${provider}` : ""}. Complete booking with the partner, then save confirmation on My
            Trip.
          </p>
          <ul className="ct-marketplace-offer-list">
            {offers.map((offer) => (
              <li key={offer.id} className="ct-marketplace-offer">
                <div>
                  <strong>
                    {offer.company || "Rental"} · {offer.vehicleName || offer.vehicleClass || "Vehicle"}
                  </strong>
                  <p>
                    {offer.pickupLocation}
                    {offer.dropoffLocation !== offer.pickupLocation ? ` → ${offer.dropoffLocation}` : ""}
                  </p>
                  <p>{money(offer.totalRateCents, offer.currency)} total est.</p>
                </div>
                <MarketplaceOfferActions
                  kind="car"
                  offer={offer as unknown as Record<string, unknown>}
                  label={offer.bookingUrl ? "Continue booking" : "Start booking on My Trip"}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : offers ? (
        <MarketplaceSearchOutcome code={code} reason={reason} />
      ) : (
        <p className="ct-honest-hint">
          Enter a US pick-up location and search. Live inventory appears only when Expedia Rapid or Enterprise Amadeus
          cars are connected.
        </p>
      )}
    </div>
  );
}
