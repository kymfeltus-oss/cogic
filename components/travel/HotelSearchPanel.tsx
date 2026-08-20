"use client";

import { Headphones, Mail, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";
import HotelSearchClient from "@/components/travel/HotelSearchClient";
import type { TravelHotel } from "@/lib/travel/types";

export default function HotelSearchPanel({ hotels, eligibility }: { hotels: TravelHotel[]; eligibility:{eligible:boolean;productName:string|null;maximumNights:number|null} }) {
  return (
    <div className="ct-tab-panel-inner">
      <div className="ct-section-head">
        <div>
          <h2>Official COGIC Hotels &amp; US Marketplace</h2>
          <p>
            <ShieldCheck aria-hidden="true" /> Negotiated rates, live partner inventory, and a synchronized map.
          </p>
        </div>
      </div>
      {eligibility.eligible ? (
        <>
          <p className="mb-4 rounded border border-white/15 p-3">Housing eligibility: <strong>{eligibility.productName}</strong>{eligibility.maximumNights ? ` · maximum ${eligibility.maximumNights} nights` : ""}</p>
          <HotelSearchClient hotels={hotels} />
        </>
      ) : (
        <section className="rounded border border-yellow-400/30 p-5">
          <p>Holy Convocation registration is required before accessing official convention housing.</p>
          <Link href="/register" className="ct-neon-button mt-4 inline-flex">Register Now</Link>
        </section>
      )}
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
