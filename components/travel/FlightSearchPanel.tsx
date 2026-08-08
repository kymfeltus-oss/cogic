"use client";

import { useState, type FormEvent } from "react";
import { HonestUnavailable } from "@/components/travel/TravelShell";

type TripType = "roundtrip" | "oneway";

export default function FlightSearchPanel({ showHeading = true }: { showHeading?: boolean }) {
  const [tripType, setTripType] = useState<TripType>("roundtrip");
  const [from, setFrom] = useState("");
  const [depart, setDepart] = useState("2026-11-08");
  const [ret, setRet] = useState("2026-11-15");
  const [travelers, setTravelers] = useState(1);
  const [cabin, setCabin] = useState("Economy");
  const [searched, setSearched] = useState(false);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setSearched(true);
    void fetch("/api/travel/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "travel_flight_search_started",
        properties: { tripType, cabin, travelers, to: "STL" },
      }),
    }).catch(() => undefined);
  }

  return (
    <div className="ct-tab-panel-inner">
      {showHeading ? (
        <div className="ct-section-head">
          <div>
            <h2>Flights</h2>
            <p>Search flights to St. Louis for Holy Convocation.</p>
          </div>
        </div>
      ) : null}

      <form className="ct-card ct-card--feature ct-marketplace-form" onSubmit={onSearch}>
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
              onChange={(e) => setFrom(e.target.value)}
              placeholder="Airport / city"
              autoComplete="off"
            />
          </label>
          <label>
            To
            <input value="St. Louis (STL)" readOnly />
          </label>
          <label>
            Depart
            <input type="date" value={depart} onChange={(e) => setDepart(e.target.value)} />
          </label>
          {tripType === "roundtrip" ? (
            <label>
              Return
              <input type="date" value={ret} onChange={(e) => setRet(e.target.value)} />
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

        <button type="submit" className="ct-search-submit">
          Search Flights
        </button>
      </form>

      {searched ? (
        <HonestUnavailable kind="flight" embedded />
      ) : (
        <p className="ct-honest-hint">
          Enter your travel details and search. Live flight inventory appears only when a travel partner is connected.
        </p>
      )}
    </div>
  );
}
