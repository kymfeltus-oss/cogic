"use client";

import { useState } from "react";
import TravelModeTabs from "@/components/travel/TravelModeTabs";
import HotelSearchPanel from "@/components/travel/HotelSearchPanel";
import FlightSearchPanel from "@/components/travel/FlightSearchPanel";
import RentalCarSearchPanel from "@/components/travel/RentalCarSearchPanel";
import type { TravelHotel, TravelSearchKind } from "@/lib/travel/types";

export type TravelTab = TravelSearchKind;

export default function TravelHubClient({ hotels }: { hotels: TravelHotel[] }) {
  const [activeTab, setActiveTab] = useState<TravelTab>("hotels");

  return (
    <>
      <section className="ct-search ct-search-tabs-only" aria-label="Travel search modes">
        <TravelModeTabs activeTab={activeTab} onChange={setActiveTab} />
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
    </>
  );
}
