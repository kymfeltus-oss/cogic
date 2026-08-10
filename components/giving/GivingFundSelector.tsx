"use client";

import { Church, Globe2, HandHeart, HeartHandshake } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { GivingFund, GivingFundKey } from "@/lib/giving/types";

const FUND_ICONS: Record<string, LucideIcon> = {
  tithes: HandHeart,
  offering: HeartHandshake,
  missions: Globe2,
  general_fund: Church,
};

type GivingFundSelectorProps = {
  funds: readonly GivingFund[];
  selected: GivingFundKey;
  onSelect: (key: GivingFundKey) => void;
};

export default function GivingFundSelector({
  funds,
  selected,
  onSelect,
}: GivingFundSelectorProps) {
  if (funds.length === 0) {
    return (
      <section aria-labelledby="cogic-giving-fund-label">
        <p id="cogic-giving-fund-label" className="cogic-giving-label">
          Fund
        </p>
        <p className="text-sm text-white/70" role="status">
          No giving funds are available right now.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="cogic-giving-fund-label">
      <p id="cogic-giving-fund-label" className="cogic-giving-label">
        Fund
      </p>
      <div className="cogic-giving-fund" role="group" aria-label="Select fund">
        {funds.map((fund) => {
          const Icon = FUND_ICONS[fund.key] ?? HandHeart;
          const pressed = selected === fund.key;
          return (
            <button
              key={fund.key}
              type="button"
              className="cogic-giving-fund__btn touch-target"
              aria-pressed={pressed}
              onClick={() => onSelect(fund.key)}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span>{fund.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
