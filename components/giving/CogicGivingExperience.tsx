"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Bell,
  ChevronDown,
  ChevronLeft,
  Crown,
  FileCheck2,
  Heart,
  HeartHandshake,
  LockKeyhole,
  Play,
  Search,
  ShieldCheck,
} from "lucide-react";
import GivingAmountInput from "@/components/giving/GivingAmountInput";
import GivingBrandHeader from "@/components/giving/GivingBrandHeader";
import GivingFundSelector from "@/components/giving/GivingFundSelector";
import GivingNoteField from "@/components/giving/GivingNoteField";
import GivingPaymentMethods from "@/components/giving/GivingPaymentMethods";
import GivingQuickAmounts from "@/components/giving/GivingQuickAmounts";
import GivingSecurityFooter from "@/components/giving/GivingSecurityFooter";
import GivingSubmitButton from "@/components/giving/GivingSubmitButton";
import { ATTENDEE_DASHBOARD_PATH } from "@/lib/navigation/back-to-dashboard";
import {
  DEFAULT_GIVING_FUND_KEY,
  getGivingFund,
  listActiveGivingFunds,
} from "@/lib/giving/funds";
import type { GivingFundKey, GivingPaymentMethodId } from "@/lib/giving/types";
import {
  formatUsdFromCents,
  validateGivingCheckoutInput,
} from "@/lib/giving/validation";
import { getClientAppUrl } from "@/lib/client-api";
import {
  amountToCents,
  parseAmountDollars,
  sanitizeAmountInput,
} from "@/lib/vital-seed/custom-amount";

function parseDraftToCents(draft: string): number {
  const dollars = parseAmountDollars(sanitizeAmountInput(draft));
  if (dollars == null) return 0;
  return amountToCents(dollars);
}

function givingFundDisplayLabel(key: GivingFundKey, label: string): string {
  return key === "tithes" ? "Tithes & Offerings" : label;
}

export default function CogicGivingExperience() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  const [amountCents, setAmountCents] = useState(0);
  const [amountDraft, setAmountDraft] = useState("");
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [fundKey, setFundKey] = useState<GivingFundKey>(DEFAULT_GIVING_FUND_KEY);
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<GivingPaymentMethodId | null>("card");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"form" | "success" | "canceled">(
    success ? "success" : canceled ? "canceled" : "form",
  );
  const activeFunds = listActiveGivingFunds();

  useEffect(() => {
    if (!success && !canceled) return;
    window.history.replaceState({}, "", pathname);
  }, [success, canceled, pathname]);

  const handleDraftChange = useCallback((value: string) => {
    const sanitized = sanitizeAmountInput(value.replace(/^\$/, ""));
    setAmountDraft(sanitized);
    setActivePreset(null);
    setAmountCents(parseDraftToCents(sanitized));
    setError(null);
  }, []);

  const handleQuickSelect = useCallback((cents: number) => {
    setActivePreset(cents);
    setAmountCents(cents);
    setAmountDraft((cents / 100).toFixed(2));
    setError(null);
  }, []);

  const canSubmit = useMemo(() => {
    return paymentMethod !== null && validateGivingCheckoutInput({
      amountInCents: amountCents,
      fundKey,
      note,
      paymentMethod,
    }).ok;
  }, [amountCents, fundKey, note, paymentMethod]);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (loading) return;

      if (!paymentMethod) {
        setError("Please select the available payment method.");
        return;
      }

      const sourceTypeParam = searchParams.get("sourceType");
      const mediaId = searchParams.get("mediaId") ?? undefined;
      const eventOccurrenceId =
        searchParams.get("occurrenceId") ??
        searchParams.get("eventOccurrenceId") ??
        undefined;
      const collectionId = searchParams.get("collectionId") ?? undefined;
      const eventId = searchParams.get("eventId") ?? undefined;

      const validated = validateGivingCheckoutInput({
        amountInCents: amountCents,
        fundKey,
        note,
        source:
          sourceTypeParam === "replay"
            ? "replay-giving"
            : sourceTypeParam === "live"
              ? "live-giving"
              : sourceTypeParam === "collection"
                ? "collection-giving"
                : "cogic-giving",
        paymentMethod,
        sourceType: sourceTypeParam ?? "cogic_giving",
        mediaId,
        eventId,
        eventOccurrenceId,
        collectionId,
      });

      if (validated.ok === false) {
        setError(validated.error);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${getClientAppUrl()}/api/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(validated.value),
        });
        const data = (await response.json()) as { url?: string; error?: string };

        if (response.status === 401) {
          setError("Sign in to continue giving.");
          return;
        }

        if (!response.ok || !data.url) {
          setError(data.error || "Unable to start checkout. Please try again.");
          return;
        }

        window.location.assign(data.url);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [amountCents, fundKey, loading, note, paymentMethod, searchParams],
  );

  if (status === "success") {
    const fund = getGivingFund(fundKey);
    return (
      <div className="cogic-giving-shell">
        <Link href={ATTENDEE_DASHBOARD_PATH} className="cogic-giving-back">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Back
        </Link>
        <div className="cogic-giving-card cogic-giving-status">
          <GivingBrandHeader />
          <h2>Thank you</h2>
          <p>
            If your payment completed, Stripe has confirmed your gift
            {amountCents > 0 ? ` of ${formatUsdFromCents(amountCents)}` : ""}
            {fund ? ` to ${fund.label}` : ""}. Final confirmation is recorded by the secure
            webhook — not by this browser redirect alone.
          </p>
          <Link href={ATTENDEE_DASHBOARD_PATH} className="cogic-giving-submit">
            Return to COGIC LIVE
          </Link>
          <button
            type="button"
            className="cogic-giving-quick__btn"
            onClick={() => setStatus("form")}
          >
            Give again
          </button>
        </div>
      </div>
    );
  }

  if (status === "canceled") {
    return (
      <div className="cogic-giving-shell">
        <Link href={ATTENDEE_DASHBOARD_PATH} className="cogic-giving-back">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Back
        </Link>
        <div className="cogic-giving-card cogic-giving-status">
          <GivingBrandHeader />
          <h2>Checkout canceled</h2>
          <p>No payment was completed. You can return and try again when ready.</p>
          <button
            type="button"
            className="cogic-giving-submit"
            onClick={() => setStatus("form")}
          >
            Return to giving
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cogic-giving-shell">
      <header className="cogic-giving-reference-nav" aria-label="COGIC LIVE navigation">
        <div className="cogic-giving-reference-nav__inner">
          <Link href="/my-convocation" className="cogic-giving-reference-nav__brand">
            <span className="cogic-giving-reference-nav__mark"><Play aria-hidden="true" /></span>
            <span>COGIC <b>LIVE</b></span>
          </Link>
          <nav aria-label="Primary">
            <Link href="/my-convocation">Home</Link>
            <Link href="/live">Live</Link>
            <Link href="/my-convocation">My Convocation</Link>
            <Link href="/travel">Travel</Link>
            <Link className="is-active" href="/giving" aria-current="page">Give</Link>
            <Link href="/prayer">Prayer Room</Link>
            <Link href="/my-convocation" className="cogic-giving-reference-nav__more">More <ChevronDown aria-hidden="true" /></Link>
          </nav>
          <div className="cogic-giving-reference-nav__actions">
            <span className="cogic-giving-reference-nav__action-icon" aria-hidden="true"><Search /></span>
            <Link href="/updates" aria-label="View updates" className="cogic-giving-reference-nav__notification"><Bell aria-hidden="true" /></Link>
            <Link href="/my-convocation?view=profile" aria-label="Open attendee profile" className="cogic-giving-reference-nav__avatar">JD</Link>
            <ChevronDown className="cogic-giving-reference-nav__account-caret" aria-hidden="true" />
          </div>
        </div>
      </header>

      <div className="cogic-giving-content">
        <Link href={ATTENDEE_DASHBOARD_PATH} className="cogic-giving-back">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Back
        </Link>

        <form className="cogic-giving-card" onSubmit={onSubmit} noValidate>
          <GivingBrandHeader />
          <section className="cogic-giving-reference-grid">
            <section className="cogic-giving-reference-grid__give brand-card brand-card--hero brand-card--gold" aria-labelledby="cogic-giving-purpose-heading">
              <p id="cogic-giving-purpose-heading" className="cogic-giving-panel-heading"><Heart aria-hidden="true" /> Give with Purpose</p>
              <GivingAmountInput cents={amountCents} draft={amountDraft} onDraftChange={handleDraftChange} />
              <p className="cogic-giving-amount-copy">Every gift makes an eternal impact.</p>
              <div className="cogic-giving-frequency" aria-label="Giving frequency">
                <span className="is-active">One-Time Gift</span>
              </div>
              <GivingQuickAmounts selectedCents={activePreset} onSelect={handleQuickSelect} />
              <label className="cogic-giving-fund-select">
                <span>Where would you like your gift to go?</span>
                <select value={fundKey} onChange={(event) => setFundKey(event.target.value as GivingFundKey)}>
                  {activeFunds.map((fund) => (
                    <option key={fund.key} value={fund.key}>
                      {givingFundDisplayLabel(fund.key, fund.label)}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" />
              </label>
              {error ? <p className="cogic-giving-error" role="alert">{error}</p> : null}
              <GivingSubmitButton disabled={!canSubmit} loading={loading} />
              <p className="cogic-giving-powered">Secure giving powered by <b>stripe</b></p>
              <details className="cogic-giving-options">
                <summary>Payment options and optional note</summary>
                <div className="cogic-giving-options__body">
                  <GivingNoteField value={note} onChange={setNote} />
                  <GivingPaymentMethods
                    selected={paymentMethod}
                    onSelect={(method) => {
                      setPaymentMethod(method);
                      setError(null);
                    }}
                  />
                </div>
              </details>
              <GivingSecurityFooter />
            </section>

            <section className="cogic-giving-reference-grid__funds brand-card brand-card--feature" aria-labelledby="cogic-giving-ways-heading">
              <p id="cogic-giving-ways-heading" className="cogic-giving-panel-heading"><HeartHandshake aria-hidden="true" /> Ways to Give</p>
              <GivingFundSelector selected={fundKey} onSelect={setFundKey} />
              <p className="cogic-giving-funds-link">Active Funds &amp; Initiatives</p>
            </section>

            <div className="cogic-giving-reference-grid__summary">
              <aside className="cogic-giving-summary brand-card brand-card--info" aria-label="Giving summary">
                <p className="cogic-giving-summary__eyebrow"><BarChart3 aria-hidden="true" /> Your Giving Summary</p>
                <strong>{amountCents > 0 ? formatUsdFromCents(amountCents) : "—"}</strong>
                <span>{amountCents > 0 ? "Current gift amount" : "Sign in to view your giving history"}</span>
                <div className="cogic-giving-summary__stats"><span><b>—</b> Donations</span><span><b>—</b> Funds</span><span><b>—</b> Receipts</span></div>
                <Link href="/my-convocation" className="cogic-giving-summary__link">View Giving History</Link>
              </aside>

              <aside className="cogic-giving-impact brand-card brand-card--info" aria-label="Kingdom impact">
                <p><HeartHandshake aria-hidden="true" /> Kingdom Impact</p>
                <div className="cogic-giving-impact__globe" aria-hidden="true">
                  <svg viewBox="0 0 340 130" fill="none">
                    <g className="cogic-giving-impact__land">
                      <path d="m14 34 14-15 29 3 14-10 29 9 5 17-16 9-5 18-21 6-12-12-24-1-13-13Z" />
                      <path d="m92 70 17-2 17 15 4 27-17 10-15-13-9-20Z" />
                      <path d="m129 26 15-13 31 4 15 17-12 13-5 20-26 3-18-17Z" />
                      <path d="m169 68 20-3 19 15-2 28-18 10-17-16-7-20Z" />
                      <path d="m200 32 19-12 34 9 20 19-10 20-20 6-18-13-22-3-8-17Z" />
                      <path d="m259 82 19-5 23 13-5 18-25 5-16-13Z" />
                      <path d="m302 87 15-4 14 9-4 13-17 3-11-10Z" />
                    </g>
                    <g className="cogic-giving-impact__routes">
                      <path d="M34 41 76 48 149 37 236 43 284 92" />
                      <path d="M59 28 106 85 183 92 246 56" />
                      <path d="m153 33 36 48 83-26" />
                    </g>
                    <g className="cogic-giving-impact__dots">
                      <circle cx="34" cy="41" r="2" /><circle cx="76" cy="48" r="1.7" />
                      <circle cx="106" cy="85" r="2" /><circle cx="149" cy="37" r="2" />
                      <circle cx="183" cy="92" r="1.6" /><circle cx="236" cy="43" r="2" />
                      <circle cx="246" cy="56" r="1.7" /><circle cx="284" cy="92" r="2" />
                    </g>
                  </svg>
                </div>
                <strong>Every gift advances the mission.</strong>
                <span>Sign in to view COGIC giving impact updates.</span>
              </aside>
            </div>
          </section>
        </form>

        <section className="cogic-giving-benefits brand-card brand-card--feature" aria-label="Giving benefits">
          <div><ShieldCheck aria-hidden="true" /><p><strong>100% Secure</strong><span>Bank-level encryption</span></p></div>
          <div><FileCheck2 aria-hidden="true" /><p><strong>Tax Deductible</strong><span>Receipts provided for all gifts</span></p></div>
          <div><LockKeyhole aria-hidden="true" /><p><strong>Flexible Giving</strong><span>Give how and when you want</span></p></div>
          <div><Crown aria-hidden="true" /><p><strong>Kingdom Focused</strong><span>Every gift advances the mission</span></p></div>
        </section>

        <footer className="cogic-giving-footer">
          <p>© 2026 Church Of God In Christ. All Rights Reserved.</p>
        </footer>
      </div>
    </div>
  );
}
