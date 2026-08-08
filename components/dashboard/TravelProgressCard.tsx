"use client";

import { useEffect, useState } from "react";
import DashboardLinkCard from "./DashboardLinkCard";
import { Plane } from "lucide-react";

export default function TravelProgressCard() {
  const [reserved, setReserved] = useState(false);

  useEffect(() => {
    void fetch("/api/travel/reservations", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((x) => {
        if (x?.primary) setReserved(true);
      });
  }, []);

  return (
    <DashboardLinkCard
      eyebrow="COGIC Travel Hub"
      title={reserved ? "HOTEL RESERVED" : "PLAN YOUR TRIP"}
      body={
        reserved
          ? "Your confirmed hotel stay is saved in COGIC Travel."
          : "Official hotels, flights, transportation, and your itinerary."
      }
      href="/travel"
      action={reserved ? "View Travel Details" : "Plan Your Trip"}
      icon={Plane}
      tone="gold"
      tier="primary"
    />
  );
}
