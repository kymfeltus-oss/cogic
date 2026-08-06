"use client";

import { CreditCard } from "lucide-react";
import type { GivingPaymentMethodId } from "@/lib/giving/types";

/**
 * Only payment methods supported by production checkout are shown.
 * Hosted Stripe Checkout uses card (+ Link when available in Stripe).
 */
export default function GivingPaymentMethods({
  selected,
  onSelect,
}: {
  selected: GivingPaymentMethodId | null;
  onSelect: (method: GivingPaymentMethodId) => void;
}) {
  return (
    <section aria-labelledby="cogic-giving-pay-label">
      <p id="cogic-giving-pay-label" className="cogic-giving-label">
        Pay with
      </p>
      <div className="cogic-giving-pay" role="group" aria-label="Payment methods">
        <button
          type="button"
          className="cogic-giving-pay__btn touch-target"
          aria-pressed={selected === "card"}
          onClick={() => onSelect("card")}
        >
          <CreditCard className="size-5" aria-hidden="true" />
          Card / Link
        </button>
      </div>
      <p className="mt-2 text-center text-[0.72rem] text-[var(--cg-muted)]">
        Continues to secure Stripe Checkout. Additional wallets may appear there when your device
        supports them.
      </p>
    </section>
  );
}
