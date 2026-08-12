import { Suspense } from "react";
import TravelCheckoutClient from "@/components/travel/checkout/TravelCheckoutClient";
import { getStripePublishableKey } from "@/lib/checkout/stripe-publishable";
import "../checkout.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Continue Travel Checkout | COGIC Travel",
  description:
    "Resume your secure COGIC Travel checkout from My Trip using the server PaymentIntent — no browser session stash required.",
};

export default function TravelCheckoutContinuePage() {
  const publishableKey = getStripePublishableKey();

  return (
    <Suspense
      fallback={
        <main className="tc-page">
          <h1>Continue checkout</h1>
          <p className="tc-hint">
            Loading your pending PaymentIntent from the server. Amounts come from the live ledger — session
            storage is not required.
          </p>
          <section className="tc-panel" aria-busy="true" aria-label="Resuming checkout">
            <div className="tc-skeleton">
              <span />
              <span />
              <span />
              <span />
            </div>
          </section>
        </main>
      }
    >
      <TravelCheckoutClient publishableKey={publishableKey} resumeOnly />
    </Suspense>
  );
}
