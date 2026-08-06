"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
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
  const [paymentMethod, setPaymentMethod] = useState<GivingPaymentMethodId | null>(null);
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
    return paymentMethod === "card" && validateGivingCheckoutInput({
      amountInCents: amountCents,
      fundKey,
      note,
    }).ok;
  }, [amountCents, fundKey, note, paymentMethod]);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (loading) return;

      if (paymentMethod !== "card") {
        setError("Please select the available payment method.");
        return;
      }

      const validated = validateGivingCheckoutInput({
        amountInCents: amountCents,
        fundKey,
        note,
        source: "cogic-giving",
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
    [amountCents, fundKey, loading, note, paymentMethod],
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
      <Link href={ATTENDEE_DASHBOARD_PATH} className="cogic-giving-back">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Back
      </Link>
      <form className="cogic-giving-card" onSubmit={onSubmit} noValidate>
        <GivingBrandHeader />
        <GivingOrganizationCard />
        <GivingAmountInput
          cents={amountCents}
          draft={amountDraft}
          onDraftChange={handleDraftChange}
        />
        <GivingQuickAmounts selectedCents={activePreset} onSelect={handleQuickSelect} />
        <GivingFundSelector selected={fundKey} onSelect={setFundKey} />
        <GivingNoteField value={note} onChange={setNote} />
        <GivingPaymentMethods
          selected={paymentMethod}
          onSelect={(method) => {
            setPaymentMethod(method);
            setError(null);
          }}
        />
        {error ? (
          <p className="cogic-giving-error" role="alert">
            {error}
          </p>
        ) : null}
        <GivingSubmitButton disabled={!canSubmit} loading={loading} />
        <GivingSecurityFooter />
      </form>
    </div>
  );
}
