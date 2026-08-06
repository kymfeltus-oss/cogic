"use client";

type GivingAmountInputProps = {
  cents: number;
  draft: string;
  onDraftChange: (value: string) => void;
};

function displayAmount(draft: string, cents: number): string {
  if (draft.length > 0) return draft;
  return (cents / 100).toFixed(2);
}

export default function GivingAmountInput({
  cents,
  draft,
  onDraftChange,
}: GivingAmountInputProps) {
  const amount = displayAmount(draft, cents);
  const amountSizeClass =
    amount.length > 10
      ? " cogic-giving-amount__display--tight"
      : amount.length > 7
        ? " cogic-giving-amount__display--compact"
        : "";

  return (
    <section className="cogic-giving-amount" aria-labelledby="cogic-giving-amount-label">
      <p id="cogic-giving-amount-label" className="cogic-giving-label">
        Amount
      </p>
      <label className="sr-only" htmlFor="cogic-giving-amount-input">
        Gift amount in US dollars
      </label>
      <div className="cogic-giving-amount__row">
        <span className="cogic-giving-amount__currency" aria-hidden="true">
          $
        </span>
        <input
          id="cogic-giving-amount-input"
          className={`cogic-giving-amount__display${amountSizeClass}`}
          inputMode="decimal"
          autoComplete="transaction-amount"
          value={amount}
          onFocus={(event) => {
            if (!draft) {
              onDraftChange(cents > 0 ? (cents / 100).toFixed(2) : "");
            }
            event.currentTarget.select();
          }}
          onChange={(event) => onDraftChange(event.target.value)}
          aria-describedby="cogic-giving-amount-label"
        />
      </div>
    </section>
  );
}
