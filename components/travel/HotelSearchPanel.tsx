"use client";

import { Headphones, Mail, Phone, ShieldCheck } from "lucide-react";
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
        <span className="ct-housing-help__icon" aria-hidden="true">
          <Headphones />
        </span>
        <div>
          <h3>Need Housing Help?</h3>
          <p>COGIC Housing is ready to help with your official stay.</p>
        </div>
        <div className="ct-housing-help__contacts">
          <a href="mailto:housing@cogic.org">
            <Mail aria-hidden="true" /> housing@cogic.org
          </a>
          <a href="tel:+17138242079">
            <Phone aria-hidden="true" /> (713) 824-2079
          </a>
        </div>
      </section>
    </div>
  );
}
