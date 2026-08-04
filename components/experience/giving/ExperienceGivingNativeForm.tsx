"use client";

import { Check, Loader2, Pencil } from "lucide-react";
import { givingAmounts } from "@/lib/vital-seed/giving-assets";

type ExperienceGivingNativeFormProps = {
  activePreset: number | null;
  customAmount: string;
  isLoading: boolean;
  error: string | null;
  onSelectAmount: (amount: number) => void;
  onCustomAmountChange: (value: string) => void;
  onCustomAmountFocus: () => void;
  onGiveNow: () => void;
};

function presetButtonClassName(isSelected: boolean, isDimmed: boolean): string {
  return [
    "vital-giving-preset-btn touch-target font-ui",
    isSelected ? "vital-giving-preset-btn--selected" : "",
    isDimmed ? "vital-giving-preset-btn--dimmed" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export default function ExperienceGivingNativeForm({
  activePreset,
  customAmount,
  isLoading,
  error,
  onSelectAmount,
  onCustomAmountChange,
  onCustomAmountFocus,
  onGiveNow,
}: ExperienceGivingNativeFormProps) {
  const hasPresetSelection = activePreset != null;
  const isCustomSelected = !hasPresetSelection && customAmount.trim().length > 0;

  return (
    <div className="vital-giving-form flex min-h-0 flex-1 flex-col gap-[clamp(0.35rem,2cqw,0.55rem)]">
      <section aria-label="Choose a gift amount" className="shrink-0">
        <h2 className="vital-giving-form__section-title font-ui text-brand-gradient">
          Select Amount
        </h2>
        <div
          role="radiogroup"
          aria-label="Choose a gift amount"
          className="vital-giving-preset-grid"
        >
          {givingAmounts.map((card) => {
            const isSelected = activePreset === card.amount;
            const isDimmed = hasPresetSelection && !isSelected;

            return (
              <button
                key={card.amount}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`Select $${card.amount} ${card.label} gift`}
                disabled={isLoading}
                onClick={() => onSelectAmount(card.amount)}
                className={presetButtonClassName(isSelected, isDimmed)}
              >
                {isSelected ? (
                  <span
                    className="vital-giving-preset-btn__check"
                    aria-hidden="true"
                  >
                    <Check className="size-2.5" strokeWidth={3} />
                  </span>
                ) : null}
                <span className="vital-giving-preset-btn__amount font-body">${card.amount}</span>
                <span className="vital-giving-preset-btn__label font-ui">{card.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <label
        className={[
          "vital-giving-custom-field shrink-0",
          isCustomSelected ? "vital-giving-custom-field--selected" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="sr-only">Custom amount</span>
        <Pencil className="vital-giving-custom-field__icon" aria-hidden="true" />
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-label="Enter custom gift amount"
          placeholder="Custom Amount"
          disabled={isLoading}
          value={customAmount}
          onFocus={onCustomAmountFocus}
          onClick={onCustomAmountFocus}
          onChange={(event) => onCustomAmountChange(event.target.value)}
          className="vital-giving-custom-field__input font-body"
        />
      </label>

      {error ? (
        <p role="alert" className="vital-giving-inline-error shrink-0 font-body">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={isLoading}
        onClick={onGiveNow}
        className="vital-giving-give-btn touch-target shrink-0 font-ui"
      >
        {isLoading ? (
          <>
            <Loader2 className="vital-giving-give-btn__icon animate-spin" aria-hidden="true" />
            <span className="vital-giving-give-btn__label">Preparing checkout…</span>
          </>
        ) : (
          <span className="vital-giving-give-btn__label">Give Now</span>
        )}
      </button>
    </div>
  );
}
