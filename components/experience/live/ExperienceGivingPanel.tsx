"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { getClientAppUrl } from "@/lib/client-api";
import { buildAttendeeGateUrl } from "@/lib/auth/routing";
import { useAttendeeLiveNavTarget } from "@/lib/experience/useAttendeeLiveNavTarget";
import { DEFAULT_GIVING_FUND_KEY } from "@/lib/giving/funds";
import type { GivingFundKey } from "@/lib/giving/types";

const PRESET_AMOUNTS = [25, 50, 100, 250, 500, 1000] as const;

function sanitizeAmountInput(value: string): string {
  return value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
}

export default function ExperienceGivingPanel({
  fundKey = DEFAULT_GIVING_FUND_KEY,
  heading = "Every Gift Has A Frequency",
}: {
  fundKey?: GivingFundKey;
  heading?: string;
} = {}) {
  const { href: liveNavHref } = useAttendeeLiveNavTarget();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(50);
  const [customValue, setCustomValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [checkoutOpened, setCheckoutOpened] = useState(false);

  const activeDollars = customValue ? Number.parseFloat(customValue) : selectedAmount;

  const handleGive = useCallback(async () => {
    const dollars = activeDollars;

    if (!dollars || !Number.isFinite(dollars) || dollars <= 0) {
      setError("Please select or enter a valid giving amount.");
      return;
    }

    const amountInCents = Math.round(dollars * 100);

    if (amountInCents < 50) {
      setError("Minimum transaction value not met.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNeedsSignIn(false);

    try {
      const response = await fetch(`${getClientAppUrl()}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amountInCents,
          fundKey,
          source: "live-giving-panel",
          sourceType: "live",
          paymentMethod: "card",
        }),
      });

      const data = (await response.json()) as { url?: string; error?: string };

      if (response.status === 401) {
        setNeedsSignIn(true);
        setError("Sign in before giving.");
        return;
      }

      if (!response.ok || !data.url) {
        setError(data.error ?? "Unable to start checkout. Please try again.");
        return;
      }

      const checkoutWindow = window.open(data.url, "_blank", "noopener,noreferrer");
      if (!checkoutWindow) {
        setError("Allow pop-ups to open secure checkout, or try again.");
        return;
      }

      setCheckoutOpened(true);
    } catch {
      setError("Unable to reach checkout. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [activeDollars, fundKey]);

  return (
    <div>
      <p className="font-headline text-xl uppercase tracking-[0.14em] text-white sm:text-2xl">
        {heading}
      </p>
      <p className="mt-2 font-body text-sm leading-relaxed text-brand-muted">
        Support the mission through COGIC Giving.
      </p>
      <p className="mt-2 font-body text-xs leading-relaxed text-brand-muted">
        Secure checkout opens in a new tab — your live stream stays on this page.
      </p>

      <div className="mt-4 flex items-center justify-center">
        <Heart className="h-8 w-8 exp-text-magenta" strokeWidth={1.2} aria-hidden="true" />
      </div>

      <p className="mt-4 text-center font-ui text-[0.58rem] font-bold uppercase tracking-[0.16em] text-brand-muted">
        Choose an amount
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
        {PRESET_AMOUNTS.map((amount) => {
          const isActive = selectedAmount === amount && !customValue;
          return (
            <button
              key={amount}
              type="button"
              onClick={() => {
                setSelectedAmount(amount);
                setCustomValue("");
                setError(null);
              }}
              className={`touch-target rounded-xl border px-2 py-3 font-ui text-sm font-bold transition ${
                isActive
                  ? "border-[#B0267A] bg-[#B0267A]/10 text-white shadow-[0_0_24px_rgba(176,38,122,0.35)]"
                  : "border-white/8 bg-black/40 text-white/80 hover:border-[#1E40AF]/40"
              }`}
            >
              ${amount}
            </button>
          );
        })}
      </div>

      <label className="mt-4 block">
        <span className="sr-only">Custom amount</span>
        <input
          type="text"
          inputMode="decimal"
          value={customValue}
          onChange={(event) => {
            const sanitized = sanitizeAmountInput(event.target.value);
            setCustomValue(sanitized);
            if (sanitized) setSelectedAmount(null);
            setError(null);
          }}
          placeholder="$ Enter Amount"
          className="w-full rounded-xl border border-white/8 bg-black/60 px-4 py-3 text-center font-body text-sm text-white outline-none placeholder:text-zinc-500 focus:border-[#1E40AF]/50"
        />
      </label>

      {error ? (
        <div className="mt-3">
          <p className="font-body text-xs exp-text-magenta" role="status">
            {error}
          </p>
          {needsSignIn ? (
            <Link
              href={buildAttendeeGateUrl(liveNavHref)}
              className="mt-2 inline-flex min-h-11 items-center justify-center rounded-full border border-[#1E40AF]/50 bg-[#1E40AF]/10 px-6 py-2 font-ui text-[0.62rem] font-bold uppercase tracking-[0.14em] exp-text-blue transition hover:bg-[#1E40AF]/20"
            >
              Sign In
            </Link>
          ) : null}
        </div>
      ) : null}

      {checkoutOpened ? (
        <p className="mt-3 rounded-lg border border-[#1E40AF]/30 bg-[#1E40AF]/10 px-3 py-2 font-body text-xs leading-relaxed text-zinc-400">
          Secure checkout is open in another tab. Complete your gift there, then return here to
          keep watching live.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleGive()}
        disabled={!activeDollars || isSubmitting}
        className="experience-send-btn mt-4 flex w-full min-h-12 items-center justify-center gap-2 rounded-xl font-ui text-[0.65rem] font-bold uppercase tracking-[0.16em] text-black transition active:scale-[0.99] disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Opening Checkout…</span>
          </>
        ) : (
          "Sow A Seed"
        )}
      </button>
    </div>
  );
}
