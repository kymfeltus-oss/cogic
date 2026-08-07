"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BarChart3, ChevronLeft, Crown, FileCheck2, HeartHandshake, LockKeyhole, ShieldCheck } from "lucide-react";
import GivingAmountInput from "@/components/giving/GivingAmountInput";
import GivingBrandHeader from "@/components/giving/GivingBrandHeader";
import GivingFundSelector from "@/components/giving/GivingFundSelector";
import GivingNoteField from "@/components/giving/GivingNoteField";
import GivingOrganizationCard from "@/components/giving/GivingOrganizationCard";
import GivingPaymentMethods from "@/components/giving/GivingPaymentMethods";
import GivingQuickAmounts from "@/components/giving/GivingQuickAmounts";
import GivingSecurityFooter from "@/components/giving/GivingSecurityFooter";
import GivingSubmitButton from "@/components/giving/GivingSubmitButton";
import { ATTENDEE_DASHBOARD_PATH } from "@/lib/navigation/back-to-dashboard";
import { DEFAULT_GIVING_FUND_KEY, getGivingFund } from "@/lib/giving/funds";
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
        <Link href="/my-convocation" className="cogic-giving-reference-nav__brand">COGIC <b>LIVE</b></Link>
        <nav>
          <Link href="/my-convocation">Home</Link><Link href="/live">Live</Link><Link href="/my-convocation">My Convocation</Link><Link href="/travel">Travel</Link><Link className="is-active" href="/giving">Give</Link><Link href="/prayer">Prayer Room</Link>
        </nav>
      </header>
      <Link href={ATTENDEE_DASHBOARD_PATH} className="cogic-giving-back">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Back
      </Link>
      <form className="cogic-giving-card" onSubmit={onSubmit} noValidate>
        <GivingBrandHeader />
        <section className="cogic-giving-reference-grid">
          <div className="cogic-giving-reference-grid__give">
            <GivingOrganizationCard />
            <GivingAmountInput cents={amountCents} draft={amountDraft} onDraftChange={handleDraftChange} />
            <GivingQuickAmounts selectedCents={activePreset} onSelect={handleQuickSelect} />
            <GivingNoteField value={note} onChange={setNote} />
            <GivingPaymentMethods selected={paymentMethod} onSelect={(method) => { setPaymentMethod(method); setError(null); }} />
            {error ? <p className="cogic-giving-error" role="alert">{error}</p> : null}
            <GivingSubmitButton disabled={!canSubmit} loading={loading} />
            <GivingSecurityFooter />
          </div>
          <div className="cogic-giving-reference-grid__funds">
            <p className="cogic-giving-reference-heading">Ways to Give</p>
            <GivingFundSelector selected={fundKey} onSelect={setFundKey} />
          </div>
          <div className="cogic-giving-reference-grid__summary">
            <aside className="cogic-giving-summary" aria-label="Giving summary">
          <p className="cogic-giving-summary__eyebrow"><BarChart3 aria-hidden="true" /> Your Giving Summary</p>
          <strong>{amountCents > 0 ? formatUsdFromCents(amountCents) : "—"}</strong>
          <span>{amountCents > 0 ? "Current gift amount" : "Sign in to view your giving history"}</span>
          <div className="cogic-giving-summary__stats"><span><b>—</b> Donations</span><span><b>—</b> Funds</span><span><b>—</b> Receipts</span></div>
          <Link href="/my-convocation" className="cogic-giving-summary__link">View Giving History</Link>
            </aside>
            <aside className="cogic-giving-impact" aria-label="Kingdom impact">
          <p><HeartHandshake aria-hidden="true" /> Kingdom Impact</p>
          <div className="cogic-giving-impact__globe" aria-hidden="true" />
          <strong>Every gift advances the mission.</strong>
          <span>Sign in to view COGIC giving impact updates.</span>
            </aside>
          </div>
        </section>
      </form>
      <section className="cogic-giving-benefits" aria-label="Giving benefits">
        <div><ShieldCheck aria-hidden="true" /><p><strong>100% Secure</strong><span>Bank-level encryption</span></p></div>
        <div><FileCheck2 aria-hidden="true" /><p><strong>Tax Deductible</strong><span>Receipts provided for gifts</span></p></div>
        <div><LockKeyhole aria-hidden="true" /><p><strong>Flexible Giving</strong><span>Give how and when you want</span></p></div>
        <div><Crown aria-hidden="true" /><p><strong>Kingdom Focused</strong><span>Every gift advances the mission</span></p></div>
      </section>
    </div>
  );
}
