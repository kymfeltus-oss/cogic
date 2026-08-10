"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, Car, Plane } from "lucide-react";
import TravelModeTabs from "@/components/travel/TravelModeTabs";
import HotelSearchPanel from "@/components/travel/HotelSearchPanel";
import FlightSearchPanel from "@/components/travel/FlightSearchPanel";
import RentalCarSearchPanel from "@/components/travel/RentalCarSearchPanel";
import type { TravelHotel, TravelSearchKind } from "@/lib/travel/types";

export type TravelTab = TravelSearchKind;

export default function TravelHubClient({
  hotels,
  hasSavedStay,
}: {
  hotels: TravelHotel[];
  hasSavedStay: boolean;
}) {
  const [activeTab, setActiveTab] = useState<TravelTab>("hotels");

  function selectTab(tab: TravelTab) {
    setActiveTab(tab);
    window.requestAnimationFrame(() => {
      document.getElementById("travel-search-modes")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <>
      <section id="travel-search-modes" className="ct-search ct-search-tabs-only" aria-label="Travel search modes">
        <TravelModeTabs activeTab={activeTab} onChange={selectTab} />
      </section>

      <div className="ct-tab-panels">
        <div
          id="travel-panel-hotels"
          role="tabpanel"
          aria-labelledby="travel-tab-hotels"
          className={`ct-tab-panel${activeTab === "hotels" ? " is-active" : ""}`}
          hidden={activeTab !== "hotels"}
        >
          <HotelSearchPanel hotels={hotels} />
        </div>
        <div
          id="travel-panel-flights"
          role="tabpanel"
          aria-labelledby="travel-tab-flights"
          className={`ct-tab-panel${activeTab === "flights" ? " is-active" : ""}`}
          hidden={activeTab !== "flights"}
        >
          <FlightSearchPanel />
        </div>
        <div
          id="travel-panel-cars"
          role="tabpanel"
          aria-labelledby="travel-tab-cars"
          className={`ct-tab-panel${activeTab === "cars" ? " is-active" : ""}`}
          hidden={activeTab !== "cars"}
        >
          <RentalCarSearchPanel />
        </div>
      </div>

      <section className="ct-secondary-travel" aria-label="Travel planning options">
        <button type="button" className="ct-secondary-travel__card" onClick={() => selectTab("flights")}>
          <span className="ct-secondary-travel__icon" aria-hidden="true">
            <Plane />
          </span>
          <span className="ct-secondary-travel__copy">
            <strong>Flights</strong>
            <small>Search flights to St. Louis for Holy Convocation.</small>
          </span>
          <span className="ct-secondary-travel__action">
            Search Flights <ArrowUpRight aria-hidden="true" />
          </span>
        </button>

        <button type="button" className="ct-secondary-travel__card" onClick={() => selectTab("cars")}>
          <span className="ct-secondary-travel__icon" aria-hidden="true">
            <Car />
          </span>
          <span className="ct-secondary-travel__copy">
            <strong>Rental Cars</strong>
            <small>Search rental cars for your St. Louis Convocation stay.</small>
          </span>
          <span className="ct-secondary-travel__action">
            Search Cars <ArrowUpRight aria-hidden="true" />
          </span>
        </button>

        <Link className="ct-secondary-travel__card" href="/travel/trip">
          <span className="ct-secondary-travel__icon" aria-hidden="true">
            <BriefcaseBusiness />
          </span>
          <span className="ct-secondary-travel__copy">
            <strong>My Trip</strong>
            <small>
              {hasSavedStay
                ? "Your confirmed stay is saved in COGIC Travel."
                : "Add hotel, flight, and transportation details."}
            </small>
          </span>
          <span className="ct-secondary-travel__action">
            View Details <ArrowUpRight aria-hidden="true" />
          </span>
        </Link>
      </section>
    </>
  );
}
