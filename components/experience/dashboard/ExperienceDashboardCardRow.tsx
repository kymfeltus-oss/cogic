"use client";

import Link from "next/link";
import AttendeeLiveNavLink from "@/components/navigation/AttendeeLiveNavLink";
import { AWAKENING_DASHBOARD_CARDS_MOBILE } from "@/lib/experience/awakening-dashboard-assets";

/** Transparent tap targets over baked-in card art on the dashboard backdrop. */
export default function ExperienceDashboardCardRow() {

  return (
    <div className="dashboard-hero-card-row" aria-label="Dashboard shortcuts">
      {AWAKENING_DASHBOARD_CARDS_MOBILE.map((card) =>
        card.id === "live" ? (
          <AttendeeLiveNavLink
            key={card.id}
            className="dashboard-hero-mobile-card-hit touch-target"
            aria-label={card.ariaLabel}
          />
        ) : (
          <Link
            key={card.id}
            href={card.href}
            className="dashboard-hero-mobile-card-hit touch-target"
            aria-label={card.ariaLabel}
          />
        ),
      )}
    </div>
  );
}
