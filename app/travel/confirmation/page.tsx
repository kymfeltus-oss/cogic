import { Suspense } from "react";
import TravelConfirmationClient from "@/components/travel/checkout/TravelConfirmationClient";
import "../checkout/checkout.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Booking Confirmation | COGIC Travel",
  description: "Your COGIC Travel supplier confirmation and receipt.",
};

export default function TravelConfirmationPage() {
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
      <TravelConfirmationClient />
    </Suspense>
  );
}
