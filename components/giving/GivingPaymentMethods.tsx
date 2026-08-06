"use client";

import { Apple, CreditCard, Landmark } from "lucide-react";
import type { GivingPaymentMethodId } from "@/lib/giving/types";

/**
 * Each choice creates a real Stripe Checkout session restricted to the
 * selected payment rail. Apple Pay still requires an eligible Apple device.
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
          <span>Debit / Credit Card</span>
          <small>Visa, Mastercard, and more</small>
        </button>
        <button
          type="button"
          className="cogic-giving-pay__btn touch-target"
          aria-pressed={selected === "apple_pay"}
          onClick={() => onSelect("apple_pay")}
        >
          <Apple className="size-5" aria-hidden="true" />
          <span>Apple Pay</span>
          <small>Eligible Apple devices</small>
        </button>
        <button
          type="button"
          className="cogic-giving-pay__btn touch-target"
          aria-pressed={selected === "ach"}
          onClick={() => onSelect("ach")}
        >
          <Landmark className="size-5" aria-hidden="true" />
          <span>ACH Bank</span>
          <small>US bank account</small>
        </button>
      </div>
      <p className="mt-2 text-center text-[0.72rem] text-[var(--cg-muted)]">
        Secure Stripe Checkout. ACH gifts can take several business days to settle.
      </p>
    </section>
  );
}
