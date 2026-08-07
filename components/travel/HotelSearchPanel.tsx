"use client";

import { ShieldCheck } from "lucide-react";
import OfficialHotelsClient from "@/components/travel/OfficialHotelsClient";
import type { TravelHotel } from "@/lib/travel/types";

export default function HotelSearchPanel({ hotels }: { hotels: TravelHotel[] }) {
  return (
    <div className="ct-tab-panel-inner">
      <div className="ct-section-head">
        <div>
          <h2>Official COGIC Hotels</h2>
          <p>
            <ShieldCheck aria-hidden="true" /> Negotiated rates. Preferred locations. Support the mission.
          </p>
        </div>
      </div>
      <OfficialHotelsClient hotels={hotels} />
      <section className="ct-housing-help">
        <h3>Need Housing Help?</h3>
        <p>
          Contact COGIC Housing at{" "}
          <a href="mailto:housing@cogic.org">housing@cogic.org</a> or{" "}
          <a href="tel:+17138242079">(713) 824-2079</a>.
        </p>
      </section>
    </div>
  );
}
