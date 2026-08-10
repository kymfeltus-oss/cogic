"use client";

import { useState } from "react";

type Props = {
  kind: "hotel" | "flight" | "car";
  offer: Record<string, unknown>;
  checkIn?: string;
  checkOut?: string;
  label?: string;
};

export default function MarketplaceOfferActions({
  kind,
  offer,
  checkIn,
  checkOut,
  label = "Continue booking",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function startBooking() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/travel/marketplace/booking/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, offer, checkIn, checkOut }),
      });
      const json = await response.json();
      if (!response.ok) {
        if (json.loginUrl) {
          window.location.href = json.loginUrl;
          return;
        }
        throw new Error(json.error || "Unable to start booking.");
      }

      if (json.openPartner && json.partnerUrl) {
        await fetch("/api/travel/marketplace/booking/return", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId: json.attemptId, action: "redirected" }),
        }).catch(() => undefined);
        window.open(json.partnerUrl, "_blank", "noopener,noreferrer");
        window.location.href = json.returnUrl || `/travel/marketplace/return?attempt=${json.attemptId}`;
        return;
      }

      window.location.href = json.returnUrl || `/travel/marketplace/return?attempt=${json.attemptId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start booking.");
      setBusy(false);
    }
  }

  return (
    <div className="ct-marketplace-offer__actions">
      <button type="button" className="ct-neon-button" disabled={busy} onClick={() => void startBooking()}>
        {busy ? "Starting…" : label}
      </button>
      {error ? (
        <p role="alert" className="ct-honest-hint">
          {error}
        </p>
      ) : null}
    </div>
  );
}
