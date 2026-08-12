"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { stashTravelCheckoutOffer } from "@/lib/travel/checkout/offer-session";

type Props = {
  kind: "hotel" | "flight" | "car";
  offer: Record<string, unknown>;
  checkIn?: string;
  checkOut?: string;
  pickupAt?: string;
  dropoffAt?: string;
  label?: string;
};

export default function MarketplaceOfferActions({
  kind,
  offer,
  checkIn,
  checkOut,
  pickupAt,
  dropoffAt,
  label = "Checkout securely",
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function startCheckout() {
    setBusy(true);
    setError("");
    const offerId = String(offer.id || offer.bookToken || "").trim();
    if (!offerId) {
      setError("This offer is missing a live bookable id. Search again.");
      setBusy(false);
      return;
    }

    stashTravelCheckoutOffer(offerId, {
      kind,
      offer: {
        ...offer,
        checkIn: checkIn || offer.checkIn || null,
        checkOut: checkOut || offer.checkOut || null,
        pickupAt: pickupAt || offer.pickupAt || null,
        dropoffAt: dropoffAt || offer.dropoffAt || null,
      },
      checkIn: checkIn || null,
      checkOut: checkOut || null,
      pickupAt: pickupAt || null,
      dropoffAt: dropoffAt || null,
      stashedAt: new Date().toISOString(),
    });

    const params = new URLSearchParams({ kind });
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    router.push(`/travel/checkout/${encodeURIComponent(offerId)}?${params.toString()}`);
  }

  return (
    <div className="ct-marketplace-offer__actions">
      <button
        type="button"
        className="ct-neon-button"
        disabled={busy}
        onClick={() => startCheckout()}
      >
        {busy ? "Opening checkout…" : label}
      </button>
      {error ? (
        <p role="alert" className="ct-honest-hint">
          {error}
        </p>
      ) : null}
    </div>
  );
}
