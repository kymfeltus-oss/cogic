"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import CheckoutSummaryCard from "@/components/travel/checkout/CheckoutSummaryCard";
import {
  clearTravelCheckoutOffer,
  formatTravelMoney,
  readTravelCheckoutOffer,
  type TravelCheckoutKind,
} from "@/lib/travel/checkout/offer-session";

type Phase = "LOADING" | "READY" | "CONFIRMING" | "SUPPLIER_SUBMITTED" | "ERROR";

type IntentState = {
  attemptId: string;
  paymentIntentId: string;
  clientSecret: string;
  fareCents: number;
  amountCents: number;
  taxAmountCents: number;
  serviceFeeCents: number;
  currency: string;
  provider: string;
  kind: TravelCheckoutKind;
};

type DisplaySnapshot = {
  kind: TravelCheckoutKind;
  offer: Record<string, unknown>;
  checkIn: string | null;
  checkOut: string | null;
  pickupAt: string | null;
  dropoffAt: string | null;
};

function moneyFromServerPayload(json: Record<string, unknown>) {
  const itemization =
    json.itemization && typeof json.itemization === "object"
      ? (json.itemization as Record<string, unknown>)
      : null;
  const amountCents = Math.round(
    Number(itemization?.totalAmountCents ?? json.amountCents ?? 0) || 0,
  );
  const taxAmountCents = Math.round(
    Number(itemization?.taxAmountCents ?? json.taxAmountCents ?? 0) || 0,
  );
  const serviceFeeCents = Math.round(
    Number(itemization?.serviceFeeCents ?? json.serviceFeeCents ?? 0) || 0,
  );
  const fareCents = Math.round(
    Number(itemization?.fareCents ?? json.fareCents ?? amountCents - serviceFeeCents) || 0,
  );
  return {
    fareCents: Math.max(0, fareCents),
    amountCents: Math.max(0, amountCents),
    taxAmountCents: Math.max(0, taxAmountCents),
    serviceFeeCents: Math.max(0, serviceFeeCents),
    currency: String(json.currency || "USD").toUpperCase(),
  };
}

/** Fresh-start preview only — never used when resumeOnly / attemptId hydrates from the server. */
function moneyPreview(offer: Record<string, unknown>) {
  const fare =
    Number(offer.totalRateCents ?? offer.totalFareCents ?? offer.fareCents ?? 0) || 0;
  const tax = Number(offer.taxAmountCents ?? 0) || 0;
  const service = Number(offer.serviceFeeCents ?? 0) || 0;
  return {
    fareCents: fare,
    taxAmountCents: tax,
    serviceFeeCents: service,
    totalAmountCents: fare + service,
    currency: String(offer.currency || "USD"),
  };
}

function displayFromResumePayload(
  json: Record<string, unknown>,
  nextKind: TravelCheckoutKind,
): DisplaySnapshot {
  const snapshot =
    json.offerSnapshot && typeof json.offerSnapshot === "object"
      ? (json.offerSnapshot as Record<string, unknown>)
      : {};
  const origin = String(json.originLabel || snapshot.origin || "").trim();
  const destination = String(json.destinationLabel || snapshot.destination || snapshot.name || "").trim();
  const startAt = json.startAt ? String(json.startAt) : null;
  const endAt = json.endAt ? String(json.endAt) : null;
  const hotelCheckIn =
    snapshot.checkIn != null
      ? String(snapshot.checkIn)
      : nextKind === "hotel" && startAt
        ? startAt.slice(0, 10)
        : null;
  const hotelCheckOut =
    snapshot.checkOut != null
      ? String(snapshot.checkOut)
      : nextKind === "hotel" && endAt
        ? endAt.slice(0, 10)
        : null;
  const pickupAt =
    snapshot.pickupAt != null
      ? String(snapshot.pickupAt)
      : nextKind === "car"
        ? startAt
        : null;
  const dropoffAt =
    snapshot.dropoffAt != null
      ? String(snapshot.dropoffAt)
      : nextKind === "car"
        ? endAt
        : null;

  const offer: Record<string, unknown> = {
    ...snapshot,
    name: snapshot.name || destination || "Marketplace offer",
    origin: snapshot.origin || origin,
    destination: snapshot.destination || destination,
    checkIn: hotelCheckIn,
    checkOut: hotelCheckOut,
    pickupAt,
    dropoffAt,
    departAt: snapshot.departAt || (nextKind === "flight" ? startAt : snapshot.departAt),
    arriveAt: snapshot.arriveAt || (nextKind === "flight" ? endAt : snapshot.arriveAt),
  };

  return {
    kind: nextKind,
    offer,
    checkIn: hotelCheckIn,
    checkOut: hotelCheckOut,
    pickupAt,
    dropoffAt,
  };
}

function CheckoutSkeleton({ label }: { label: string }) {
  return (
    <section className="tc-panel" aria-busy="true" aria-label={label}>
      <div className="tc-skeleton">
        <span />
        <span />
        <span />
        <span />
      </div>
      <p className="tc-hint">{label}</p>
    </section>
  );
}

function PaymentForm({
  kind,
  offerId,
  attemptId,
  onConfirming,
  onSupplierSubmitted,
  onError,
  guest,
}: {
  kind: TravelCheckoutKind;
  offerId: string;
  attemptId: string;
  onConfirming: () => void;
  onSupplierSubmitted: () => void;
  onError: (message: string) => void;
  guest: {
    givenName: string;
    familyName: string;
    phone: string;
    bornOn: string;
    gender: "m" | "f";
  };
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    if (!guest.givenName.trim() || !guest.familyName.trim()) {
      onError("Enter traveler given name and family name before paying.");
      return;
    }
    if (kind === "flight" && !/^\d{4}-\d{2}-\d{2}$/.test(guest.bornOn)) {
      onError("Flight checkout requires traveler date of birth.");
      return;
    }

    setSubmitting(true);
    onConfirming();
    onError("");

    const { error: submitError } = await elements.submit();
    if (submitError) {
      onError(submitError.message || "Card details are incomplete.");
      setSubmitting(false);
      return;
    }

    const confirmed = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: `${window.location.origin}/travel/confirmation?attemptId=${encodeURIComponent(attemptId)}`,
        payment_method_data: {
          billing_details: {
            name: `${guest.givenName} ${guest.familyName}`.trim(),
            phone: guest.phone || undefined,
          },
        },
      },
    });

    if (confirmed.error) {
      onError(confirmed.error.message || "Card payment failed.");
      setSubmitting(false);
      return;
    }

    const paymentIntentId = confirmed.paymentIntent?.id;
    if (!paymentIntentId) {
      onError("Payment succeeded but no PaymentIntent was returned.");
      setSubmitting(false);
      return;
    }

    onSupplierSubmitted();

    const complete = await fetch("/api/travel/checkout/complete-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentIntentId,
        attemptId,
        guest: {
          givenName: guest.givenName,
          familyName: guest.familyName,
          phone: guest.phone || null,
          bornOn: kind === "flight" ? guest.bornOn : null,
          gender: kind === "flight" ? guest.gender : null,
        },
      }),
    });
    const json = await complete.json().catch(() => ({}));
    if (!complete.ok || !json.ok) {
      onError(
        json.error ||
          "Your card was charged but the supplier could not complete the reservation. A refund was attempted automatically.",
      );
      setSubmitting(false);
      return;
    }

    clearTravelCheckoutOffer(offerId);
    router.replace(
      `/travel/confirmation?attemptId=${encodeURIComponent(json.attemptId || attemptId)}`,
    );
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)}>
      <div className="tc-payment">
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>
      <button className="tc-submit" type="submit" disabled={!stripe || submitting}>
        {submitting ? "Processing payment…" : "Pay & reserve"}
      </button>
    </form>
  );
}

export default function TravelCheckoutClient({
  publishableKey,
  resumeOnly = false,
}: {
  publishableKey: string | null;
  /** When true, require attemptId and resume via server (no sessionStorage). */
  resumeOnly?: boolean;
}) {
  const router = useRouter();
  const params = useParams<{ offerId?: string }>();
  const searchParams = useSearchParams();
  const offerId = decodeURIComponent(params.offerId || "");
  const attemptIdParam = String(searchParams.get("attemptId") || "").trim();
  const kindParam = (searchParams.get("kind") || "hotel") as TravelCheckoutKind;
  const useResume = resumeOnly || Boolean(attemptIdParam);
  const missingResumeAttempt = useResume && !attemptIdParam;

  const [phase, setPhase] = useState<Phase>("LOADING");
  const [error, setError] = useState("");
  /** Fresh-start path only — never required for resumeOnly / attemptId hydration. */
  const [stashed, setStashed] = useState<ReturnType<typeof readTravelCheckoutOffer>>(null);
  /** Display labels from server resume snapshot or fresh stash (not money authority). */
  const [display, setDisplay] = useState<DisplaySnapshot | null>(null);
  const [intent, setIntent] = useState<IntentState | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [activeOfferId, setActiveOfferId] = useState(offerId);
  const [guest, setGuest] = useState({
    givenName: "",
    familyName: "",
    phone: "",
    bornOn: "",
    gender: "m" as "m" | "f",
  });
  /** Prevents a second resume fetch after we sync a recreated attemptId into the URL. */
  const hydratedResumeAttemptRef = useRef<string | null>(null);

  const preview = useMemo(() => {
    if (useResume) {
      return {
        fareCents: 0,
        taxAmountCents: 0,
        serviceFeeCents: 0,
        totalAmountCents: 0,
        currency: "USD",
      };
    }
    return moneyPreview(stashed?.offer || {});
  }, [stashed, useResume]);

  useEffect(() => {
    if (useResume) {
      // Resume binds only to attemptId + /api/travel/checkout/resume — never sessionStorage.
      setStashed(null);
      if (!attemptIdParam) {
        setPhase("ERROR");
        setError("Missing checkout attempt. Open My Trip and continue from your pending booking.");
      }
      return;
    }
    const stored = readTravelCheckoutOffer(offerId);
    if (!stored) {
      setPhase("ERROR");
      setError("This offer expired in your browser session. Search again and restart checkout.");
      return;
    }
    setStashed(stored);
    setDisplay({
      kind: stored.kind || kindParam,
      offer: stored.offer,
      checkIn: stored.checkIn,
      checkOut: stored.checkOut,
      pickupAt: stored.pickupAt,
      dropoffAt: stored.dropoffAt,
    });
    setActiveOfferId(offerId);
  }, [offerId, useResume, attemptIdParam, kindParam]);

  useEffect(() => {
    if (missingResumeAttempt) return;
    if (!publishableKey) {
      if (useResume ? attemptIdParam : stashed) {
        setPhase("ERROR");
        setError(
          "Card checkout is unavailable because NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured.",
        );
      }
      return;
    }
    if (useResume && !attemptIdParam) return;
    if (!useResume && !stashed) return;
    if (useResume && hydratedResumeAttemptRef.current === attemptIdParam) return;

    let cancelled = false;
    setPhase("LOADING");
    setError("");
    setStripePromise(loadStripe(publishableKey));

    void (async () => {
      const response = await fetch(
        useResume ? "/api/travel/checkout/resume" : "/api/travel/checkout/create-intent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            useResume
              ? { attemptId: attemptIdParam }
              : {
                  kind: stashed!.kind || kindParam,
                  offerId,
                  bookToken: stashed!.offer.bookToken || null,
                  provider: stashed!.offer.provider || null,
                  checkIn: stashed!.checkIn || stashed!.offer.checkIn || null,
                  checkOut: stashed!.checkOut || stashed!.offer.checkOut || null,
                  pickupAt: stashed!.pickupAt || stashed!.offer.pickupAt || null,
                  dropoffAt: stashed!.dropoffAt || stashed!.offer.dropoffAt || null,
                  offer: stashed!.offer,
                  guest: {
                    givenName: guest.givenName || undefined,
                    familyName: guest.familyName || undefined,
                    phone: guest.phone || null,
                  },
                },
          ),
        },
      );
      const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (cancelled) return;
      if (!response.ok) {
        if (json.loginUrl) {
          window.location.href = String(json.loginUrl);
          return;
        }
        setPhase("ERROR");
        setError(
          String(json.error || "") ||
            (useResume ? "Unable to resume secure checkout." : "Unable to start secure checkout."),
        );
        return;
      }
      if (json.redirectTo) {
        window.location.href = String(json.redirectTo);
        return;
      }
      if (!json.clientSecret) {
        setPhase("ERROR");
        setError("PaymentIntent client secret was not returned.");
        return;
      }

      const money = moneyFromServerPayload(json);
      const nextKind = (String(json.kind || kindParam) || "hotel") as TravelCheckoutKind;

      if (useResume) {
        const resumeDisplay = displayFromResumePayload(json, nextKind);
        setDisplay(resumeDisplay);
        setActiveOfferId(String(json.offerId || attemptIdParam));
      } else if (json.offerSnapshot && typeof json.offerSnapshot === "object") {
        const snapshot = json.offerSnapshot as Record<string, unknown>;
        setDisplay({
          kind: nextKind,
          offer: snapshot,
          checkIn: snapshot.checkIn ? String(snapshot.checkIn) : null,
          checkOut: snapshot.checkOut ? String(snapshot.checkOut) : null,
          pickupAt: snapshot.pickupAt ? String(snapshot.pickupAt) : null,
          dropoffAt: snapshot.dropoffAt ? String(snapshot.dropoffAt) : null,
        });
        setActiveOfferId(String(json.offerId || snapshot.bookToken || offerId));
      }

      const nextAttemptId = String(json.attemptId || "").trim();
      if (useResume && nextAttemptId) {
        hydratedResumeAttemptRef.current = nextAttemptId;
        if (resumeOnly && nextAttemptId !== attemptIdParam) {
          router.replace(
            `/travel/checkout/continue?attemptId=${encodeURIComponent(nextAttemptId)}`,
          );
        }
      }

      setIntent({
        attemptId: nextAttemptId || String(json.attemptId || ""),
        paymentIntentId: String(json.paymentIntentId || ""),
        clientSecret: String(json.clientSecret || ""),
        fareCents: money.fareCents,
        amountCents: money.amountCents,
        taxAmountCents: money.taxAmountCents,
        serviceFeeCents: money.serviceFeeCents,
        currency: money.currency,
        provider: String(json.provider || ""),
        kind: nextKind,
      });
      setPhase("READY");
    })();

    return () => {
      cancelled = true;
    };
    // Resume must not re-fetch when display/snapshot state updates. Fresh start keys on stashed only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    useResume ? null : stashed,
    publishableKey,
    offerId,
    kindParam,
    useResume,
    attemptIdParam,
    missingResumeAttempt,
  ]);

  const kind = intent?.kind || display?.kind || (!useResume ? stashed?.kind : undefined) || kindParam;
  const offer = display?.offer || (!useResume ? stashed?.offer : undefined) || {};
  const interactivePhase =
    phase === "READY" ||
    phase === "CONFIRMING" ||
    phase === "ERROR" ||
    phase === "SUPPLIER_SUBMITTED";
  // Resume: amounts only after server intent lands. Fresh start may show stash labels before PI.
  const showSummary = useResume
    ? Boolean(intent) && interactivePhase
    : Boolean(intent || display) && interactivePhase;
  const canRetryPayment = Boolean(intent) && !missingResumeAttempt;
  const loadingLabel = useResume
    ? "Resuming your checkout from the server…"
    : "Checking live room/seat allocation and preparing payment…";
  const summaryFareCents = useResume ? (intent?.fareCents ?? 0) : (intent?.fareCents ?? preview.fareCents);
  const summaryTaxCents = useResume
    ? (intent?.taxAmountCents ?? 0)
    : (intent?.taxAmountCents ?? preview.taxAmountCents);
  const summaryServiceCents = useResume
    ? (intent?.serviceFeeCents ?? 0)
    : (intent?.serviceFeeCents ?? preview.serviceFeeCents);
  const summaryTotalCents = useResume
    ? (intent?.amountCents ?? 0)
    : (intent?.amountCents ?? preview.totalAmountCents);
  const summaryCurrency = useResume
    ? (intent?.currency ?? "USD")
    : (intent?.currency ?? preview.currency);
  const summaryCheckIn = useResume
    ? display?.checkIn ?? null
    : display?.checkIn ?? stashed?.checkIn ?? null;
  const summaryCheckOut = useResume
    ? display?.checkOut ?? null
    : display?.checkOut ?? stashed?.checkOut ?? null;
  const summaryPickupAt = useResume
    ? display?.pickupAt ?? null
    : display?.pickupAt ?? stashed?.pickupAt ?? null;
  const summaryDropoffAt = useResume
    ? display?.dropoffAt ?? null
    : display?.dropoffAt ?? stashed?.dropoffAt ?? null;

  return (
    <main id="main-content" className="tc-page">
      <Link href="/travel" className="tc-back">
        ← COGIC Travel
      </Link>
      <h1>{useResume ? "Continue checkout" : "Secure checkout"}</h1>
      <p className="tc-hint">
        {useResume
          ? "This link resumes your pending Stripe PaymentIntent from the server. Refresh is safe — session storage is not required."
          : "Pay in-app with Stripe. Live supplier confirmation is captured automatically after your card succeeds — no partner tabs or typed confirmation codes."}
      </p>

      <div className="tc-stack">
        {phase === "LOADING" ? <CheckoutSkeleton label={loadingLabel} /> : null}

        {showSummary ? (
          <CheckoutSummaryCard
            kind={kind}
            offer={offer}
            checkIn={summaryCheckIn}
            checkOut={summaryCheckOut}
            pickupAt={summaryPickupAt}
            dropoffAt={summaryDropoffAt}
            fareCents={summaryFareCents}
            taxAmountCents={summaryTaxCents}
            serviceFeeCents={summaryServiceCents}
            totalAmountCents={summaryTotalCents}
            currency={summaryCurrency}
          />
        ) : null}

        {phase === "SUPPLIER_SUBMITTED" ? (
          <section className="tc-panel tc-processing" aria-live="polite">
            <div className="tc-processing__pulse" aria-hidden="true" />
            <h2>Booking with the national provider network</h2>
            <p className="tc-hint">
              Payment succeeded. We are submitting your reservation to the live Expedia Rapid / Duffel
              supplier and waiting for the confirmation string. Keep this page open.
            </p>
          </section>
        ) : null}

        {(phase === "READY" || phase === "CONFIRMING") && intent && stripePromise ? (
          <section className="tc-panel" aria-labelledby="tc-traveler-heading">
            <h2 id="tc-traveler-heading">Traveler</h2>
            {phase === "CONFIRMING" ? (
              <p className="tc-hint" aria-live="polite">
                Confirming your card with Stripe…
              </p>
            ) : null}
            <label className="tc-field">
              <span>Given name</span>
              <input
                required
                value={guest.givenName}
                onChange={(event) => setGuest((current) => ({ ...current, givenName: event.target.value }))}
              />
            </label>
            <label className="tc-field">
              <span>Family name</span>
              <input
                required
                value={guest.familyName}
                onChange={(event) => setGuest((current) => ({ ...current, familyName: event.target.value }))}
              />
            </label>
            <label className="tc-field">
              <span>Phone</span>
              <input
                value={guest.phone}
                onChange={(event) => setGuest((current) => ({ ...current, phone: event.target.value }))}
              />
            </label>
            {kind === "flight" ? (
              <>
                <label className="tc-field">
                  <span>Date of birth</span>
                  <input
                    required
                    type="date"
                    value={guest.bornOn}
                    onChange={(event) => setGuest((current) => ({ ...current, bornOn: event.target.value }))}
                  />
                </label>
                <label className="tc-field">
                  <span>Gender</span>
                  <select
                    value={guest.gender}
                    onChange={(event) =>
                      setGuest((current) => ({
                        ...current,
                        gender: event.target.value === "f" ? "f" : "m",
                      }))
                    }
                  >
                    <option value="m">Male</option>
                    <option value="f">Female</option>
                  </select>
                </label>
              </>
            ) : null}

            <h2 style={{ marginTop: "1rem" }}>Card payment</h2>
            <p className="tc-hint">
              Total charged: {formatTravelMoney(intent.amountCents, intent.currency)} via {intent.provider}
            </p>
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: intent.clientSecret,
                appearance: {
                  theme: "stripe",
                  variables: {
                    colorPrimary: "#c9971a",
                    borderRadius: "10px",
                  },
                },
              }}
            >
              <PaymentForm
                kind={kind}
                offerId={activeOfferId || offerId || intent.attemptId}
                attemptId={intent.attemptId}
                guest={guest}
                onConfirming={() => setPhase("CONFIRMING")}
                onSupplierSubmitted={() => setPhase("SUPPLIER_SUBMITTED")}
                onError={(message) => {
                  if (!message) {
                    setError("");
                    return;
                  }
                  setError(message);
                  setPhase("ERROR");
                }}
              />
            </Elements>
          </section>
        ) : null}

        {phase === "ERROR" && error ? (
          <section className="tc-panel" role="alert">
            <h2>{missingResumeAttempt ? "Checkout link incomplete" : "Checkout interrupted"}</h2>
            <p className="tc-error">{error}</p>
            <p className="tc-hint">
              {missingResumeAttempt
                ? "Resume links must include attemptId from My Trip. Opening search will not restore a pending PaymentIntent."
                : "If card approval failed, update your payment details and try again. If your card was charged and the supplier rejected the room or seat, an automatic refund was attempted — open My Trip for the ledger status."}
            </p>
            <div className="tc-actions">
              {canRetryPayment ? (
                <button
                  type="button"
                  className="tc-primary"
                  onClick={() => {
                    setError("");
                    setPhase("READY");
                  }}
                >
                  Try payment again
                </button>
              ) : null}
              {!canRetryPayment && !missingResumeAttempt ? (
                <button
                  type="button"
                  className="tc-primary"
                  onClick={() => {
                    hydratedResumeAttemptRef.current = null;
                    setError("");
                    window.location.reload();
                  }}
                >
                  Retry resume
                </button>
              ) : null}
              <Link
                className={missingResumeAttempt ? "tc-primary" : "tc-secondary"}
                href="/travel/trip"
              >
                Open My Trip
              </Link>
              <Link
                className="tc-secondary"
                href={kind === "flight" ? "/travel/flights" : kind === "car" ? "/travel/cars" : "/travel"}
              >
                Back to search
              </Link>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
