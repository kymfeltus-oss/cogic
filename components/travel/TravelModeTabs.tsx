"use client";

import { BedDouble, Car, Plane } from "lucide-react";
import type { TravelSearchKind } from "@/lib/travel/types";

const TABS: { id: TravelSearchKind; label: string; shortLabel: string; icon: typeof BedDouble }[] = [
  { id: "hotels", label: "Hotels", shortLabel: "Hotels", icon: BedDouble },
  { id: "flights", label: "Flights", shortLabel: "Flights", icon: Plane },
  { id: "cars", label: "Rental Cars", shortLabel: "Cars", icon: Car },
];

export default function TravelModeTabs({
  activeTab,
  onChange,
}: {
  activeTab: TravelSearchKind;
  onChange: (tab: TravelSearchKind) => void;
}) {
  return (
    <div className="ct-tabs" role="tablist" aria-label="Travel search mode">
      {TABS.map(({ id, label, shortLabel, icon: Icon }) => {
        const selected = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`travel-tab-${id}`}
            aria-selected={selected}
            aria-controls={`travel-panel-${id}`}
            className={selected ? "active" : undefined}
            onClick={() => onChange(id)}
          >
            <Icon aria-hidden="true" />
            <span className="ct-tab-label-full">{label}</span>
            <span className="ct-tab-label-short">{shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
