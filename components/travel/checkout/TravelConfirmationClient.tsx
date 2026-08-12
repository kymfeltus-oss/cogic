"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatTravelMoney } from "@/lib/travel/checkout/offer-session";

type Receipt = {
  transactionId: string | null;
  attemptId: string | null;
  status: string;
  kind: string;
  provider: string;
  confirmationNumber: string | null;
  totalAmountCents: number | null;
  taxAmountCents: number | null;
  currency: string;
  destinationLabel: string | null;
  originLabel: string | null;
  startAt: string | null;
  endAt: string | null;
  offer: Record<string, unknown>;
  guestName?: string | null;
  confirmedAt: string | null;
  failureReason: string | null;
  paymentIntentId?: string | null;
};

export default function TravelConfirmationClient() {
  const searchParams = useSearchParams();
  const attemptId = String(searchParams.get("attemptId") || "").trim();
  const transactionIdParam = String(
    searchParams.get("transaction_id") || searchParams.get("transactionId") || "",
  ).trim();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    if (!attemptId && !transactionIdParam) {
      setLoading(false);
      setError("Missing booking reference.");
      return;
    }

    let cancelled = false;
    void (async () => {
      const params = new URLSearchParams();
      if (transactionIdParam) params.set("transaction_id", transactionIdParam);
      if (attemptId) params.set("attemptId", attemptId);
      // Confirmation viewport needs JSON metadata; bare transaction_id streams PDF.
      params.set("format", "json");
      const response = await fetch(`/api/travel/checkout/receipt?${params.toString()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const json = await response.json().catch(() => ({}));
      if (cancelled) return;
      if (!response.ok) {
        setError(json.error || "Unable to load booking confirmation.");
        setLoading(false);
        return;
      }
      setReceipt(json as Receipt);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [attemptId, transactionIdParam]);

  const handleDownloadReceipt = async (transactionId: string) => {
    setDownloadError("");
    setIsDownloading(true);
    try {
      const response = await fetch(
        `/api/travel/checkout/receipt?transaction_id=${encodeURIComponent(transactionId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || "File download failed");
      }

      const blob = await response.blob();
      if (!blob.size || String(blob.type || "").includes("json")) {
        throw new Error("PDF receipt was empty or invalid.");
      }

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "COGIC_Convocation_Receipt.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : "Failed to export transaction document.",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <main id="main-content" className="tc-page">
        <section className="tc-panel" aria-busy="true">
          <div className="tc-skeleton">
            <span />
            <span />
            <span />
          </div>
          <p className="tc-hint">Loading your confirmation…</p>
        </section>
      </main>
    );
  }

  if (error || !receipt) {
    return (
      <main id="main-content" className="tc-page">
        <section className="tc-panel" role="alert">
          <h1>Confirmation unavailable</h1>
          <p className="tc-error">{error || "Booking receipt not found."}</p>
          <div className="tc-actions">
            <Link className="tc-primary" href="/travel/trip">
              Open My Trip
            </Link>
            <Link className="tc-secondary" href="/travel">
              Back to Travel Hub
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const confirmed = receipt.status === "CONFIRMED" && receipt.confirmationNumber;
  const downloadTransactionId = String(receipt.transactionId || "").trim();

  return (
    <main id="main-content" className="tc-page">
      <Link href="/travel/trip" className="tc-back">
        ← My Trip
      </Link>

      {confirmed ? (
        <section className="tc-success-banner" aria-labelledby="tc-confirm-title">
          <h1 id="tc-confirm-title">Booking confirmed</h1>
          <p className="tc-hint" style={{ color: "rgba(236,253,245,0.9)" }}>
            Your live supplier reservation is complete. Save this verification string for check-in.
          </p>
          <p className="tc-confirm-code">{receipt.confirmationNumber}</p>
        </section>
      ) : (
        <section className="tc-panel" role="status">
          <h1>Booking status: {receipt.status.replace(/_/g, " ")}</h1>
          <p className="tc-error">
            {receipt.failureReason ||
              "This booking is not confirmed yet. Open My Trip for the latest status."}
          </p>
        </section>
      )}

      <div className="tc-stack">
        <section className="tc-card" id="tc-receipt">
          <h2>Receipt</h2>
          <dl className="tc-rows">
            {receipt.guestName ? (
              <div className="tc-row">
                <dt>Traveler</dt>
                <dd>{receipt.guestName}</dd>
              </div>
            ) : null}
            <div className="tc-row">
              <dt>Type</dt>
              <dd>{receipt.kind.toUpperCase()}</dd>
            </div>
            <div className="tc-row">
              <dt>Provider</dt>
              <dd>{receipt.provider}</dd>
            </div>
            <div className="tc-row">
              <dt>Itinerary</dt>
              <dd>
                {[receipt.originLabel, receipt.destinationLabel].filter(Boolean).join(" → ") ||
                  receipt.destinationLabel ||
                  "—"}
              </dd>
            </div>
            <div className="tc-row">
              <dt>Window</dt>
              <dd>
                {receipt.startAt ? new Date(receipt.startAt).toLocaleString() : "—"}
                {receipt.endAt ? ` – ${new Date(receipt.endAt).toLocaleString()}` : ""}
              </dd>
            </div>
            <div className="tc-row">
              <dt>Taxes & fees</dt>
              <dd>{formatTravelMoney(receipt.taxAmountCents, receipt.currency)}</dd>
            </div>
            <div className="tc-row tc-row--total">
              <dt>Amount paid</dt>
              <dd>{formatTravelMoney(receipt.totalAmountCents, receipt.currency)}</dd>
            </div>
            {receipt.paymentIntentId ? (
              <div className="tc-row">
                <dt>Payment Intent</dt>
                <dd>{receipt.paymentIntentId}</dd>
              </div>
            ) : null}
            {receipt.confirmedAt ? (
              <div className="tc-row">
                <dt>Confirmed at</dt>
                <dd>{new Date(receipt.confirmedAt).toLocaleString()}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        {isDownloading ? (
          <section className="tc-panel" aria-busy="true" aria-live="polite">
            <div className="tc-skeleton">
              <span />
              <span />
            </div>
            <p className="tc-hint">Generating your official PDF receipt…</p>
          </section>
        ) : null}

        {downloadError ? (
          <p className="tc-error" role="alert">
            {downloadError}
          </p>
        ) : null}

        <div className="tc-actions">
          <button type="button" className="tc-primary" onClick={() => window.print()}>
            Print receipt
          </button>
          <button
            type="button"
            className="tc-secondary"
            onClick={() => {
              if (!downloadTransactionId) {
                setDownloadError("Transaction reference is missing for this booking.");
                return;
              }
              void handleDownloadReceipt(downloadTransactionId);
            }}
            disabled={isDownloading || !downloadTransactionId}
            aria-busy={isDownloading}
          >
            {isDownloading ? "Generating PDF…" : "Download PDF Receipt"}
          </button>
          <Link className="tc-secondary" href="/travel/trip">
            View My Trip
          </Link>
          <Link className="tc-secondary" href="/travel">
            Back to Travel Hub
          </Link>
        </div>
      </div>
    </main>
  );
}
