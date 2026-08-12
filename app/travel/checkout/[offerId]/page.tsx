import { Suspense } from "react";
import TravelCheckoutClient from "@/components/travel/checkout/TravelCheckoutClient";
import { getStripePublishableKey } from "@/lib/checkout/stripe-publishable";
import "../checkout.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Travel Checkout | COGIC Travel",
  description: "Pay securely in-app and complete your live COGIC Travel reservation.",
};

export default function TravelCheckoutPage() {
  const publishableKey = getStripePublishableKey();

  return (
    <Suspense
      fallback={
        <main className="tc-page">
          <section className="tc-panel" aria-busy="true">
            <div className="tc-skeleton">
              <span />
              <span />
              <span />
            </div>
          </section>
        </main>
      }
    >
      <TravelCheckoutClient publishableKey={publishableKey} />
    </Suspense>
  );
}
