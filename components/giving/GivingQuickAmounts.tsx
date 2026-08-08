"use client";

import {
  QUICK_GIVING_AMOUNTS_CENTS,
  formatUsdFromCents,
} from "@/lib/giving/validation";

type GivingQuickAmountsProps = {
  selectedCents: number | null;
  onSelect: (cents: number) => void;
};

export default function GivingQuickAmounts({
  selectedCents,
  onSelect,
}: GivingQuickAmountsProps) {
  return (
    <div className="cogic-giving-quick" role="group" aria-label="Suggested amounts">
      {QUICK_GIVING_AMOUNTS_CENTS.map((cents) => {
        const pressed = selectedCents === cents;
        return (
          <button
            key={cents}
            type="button"
            className="cogic-giving-quick__btn touch-target"
            aria-pressed={pressed}
            onClick={() => onSelect(cents)}
          >
            {formatUsdFromCents(cents).replace(".00", "")}
          </button>
        );
      })}
      <button
        type="button"
        className="cogic-giving-quick__btn cogic-giving-quick__btn--custom touch-target"
        onClick={() => document.getElementById("cogic-giving-amount-input")?.focus()}
      >
        Other
      </button>
    </div>
  );
}
