"use client";

import { Church, Globe2, HandHeart, HeartHandshake } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { listActiveGivingFunds } from "@/lib/giving/funds";
import type { GivingFundKey } from "@/lib/giving/types";

const FUND_ICONS: Record<GivingFundKey, LucideIcon> = {
  tithes: HandHeart,
  offering: HeartHandshake,
  missions: Globe2,
  general_fund: Church,
};

const FUND_COPY: Record<GivingFundKey, { title: string; description: string }> = {
  tithes: {
    title: "Tithes & Offerings",
    description: "Support the everyday ministries and operations of the church.",
  },
  offering: {
    title: "Offering",
    description: "Strengthen the work of the church and its ministries.",
  },
  missions: {
    title: "Missions & Outreach",
    description: "Spread the Gospel and serve communities around the world.",
  },
  general_fund: {
    title: "General Fund",
    description: "Direct support where ministry needs are greatest.",
  },
};

type GivingFundSelectorProps = {
  selected: GivingFundKey;
  onSelect: (key: GivingFundKey) => void;
};

export default function GivingFundSelector({
  selected,
  onSelect,
}: GivingFundSelectorProps) {
  const funds = listActiveGivingFunds();

  return (
    <section aria-labelledby="cogic-giving-fund-label">
      <p id="cogic-giving-fund-label" className="cogic-giving-label">
        Fund
      </p>
      <div className="cogic-giving-fund" role="group" aria-label="Select fund">
        {funds.map((fund) => {
          const Icon = FUND_ICONS[fund.key];
          const pressed = selected === fund.key;
          const copy = FUND_COPY[fund.key];
          return (
            <button
              key={fund.key}
              type="button"
              className="cogic-giving-fund__btn touch-target"
              aria-pressed={pressed}
              onClick={() => onSelect(fund.key)}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span className="cogic-giving-fund__title">{copy.title}</span>
              <small>{copy.description}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
