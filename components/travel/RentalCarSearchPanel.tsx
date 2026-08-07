"use client";

import { useState, type FormEvent } from "react";
import { HonestUnavailable } from "@/components/travel/TravelShell";

export default function RentalCarSearchPanel() {
  const [pickupLocation, setPickupLocation] = useState("St. Louis, Missouri");
  const [differentDropoff, setDifferentDropoff] = useState(false);
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [pickupDate, setPickupDate] = useState("2026-11-08");
  const [pickupTime, setPickupTime] = useState("10:00");
  const [dropoffDate, setDropoffDate] = useState("2026-11-15");
  const [dropoffTime, setDropoffTime] = useState("10:00");
  const [driverAge, setDriverAge] = useState("25+");
  const [searched, setSearched] = useState(false);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setSearched(true);
    void fetch("/api/travel/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "travel_car_search_started",
        properties: {
          pickupLocation,
          differentDropoff,
          driverAge,
        },
      }),
    }).catch(() => undefined);
  }

  return (
    <div className="ct-tab-panel-inner">
      <div className="ct-section-head">
        <div>
          <h2>Rental Cars</h2>
          <p>Search rental cars for your St. Louis Convocation stay.</p>
        </div>
      </div>

      <form className="ct-marketplace-form" onSubmit={onSearch}>
        <div className="ct-marketplace-grid">
          <label className="ct-span-2">
            Pick-up location
            <input
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            Pick-up date
            <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
          </label>
          <label>
            Pick-up time
            <input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
          </label>
          <label>
            Drop-off date
            <input type="date" value={dropoffDate} onChange={(e) => setDropoffDate(e.target.value)} />
          </label>
          <label>
            Drop-off time
            <input type="time" value={dropoffTime} onChange={(e) => setDropoffTime(e.target.value)} />
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

        <button type="submit" className="ct-search-submit">
          Search Rental Cars
        </button>
      </form>

      {searched ? (
        <HonestUnavailable kind="rental car" embedded />
      ) : (
        <p className="ct-honest-hint">
          Enter pick-up details and search. Live rental inventory appears only when a travel partner is connected.
        </p>
      )}
    </div>
  );
}
