"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { enableDevicePush, pushSupported } from "@/lib/push/client";

const DISMISS_KEY = "cogic_push_prompt_dismissed_v1";

export default function StayConnectedPrompt({ signedIn }: { signedIn: boolean }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn || !pushSupported()) {
      setVisible(false);
      return;
    }
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") {
        setVisible(false);
        return;
      }
    } catch {
      // ignore storage failures
    }
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      setVisible(false);
      return;
    }
    setVisible(true);
  }, [signedIn]);

  if (!visible) return null;

  async function turnOn() {
    setBusy(true);
    setError(null);
    const result = await enableDevicePush();
    setBusy(false);
    if (!result.ok) {
      setError(result.error || "Unable to enable notifications.");
      return;
    }
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  function notNow() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  return (
    <section
      className="mt-4 rounded-2xl border border-[rgba(75,49,116,0.52)] bg-[linear-gradient(150deg,rgba(16,10,30,0.96),rgba(5,2,13,0.98))] px-4 py-4 sm:px-5"
      aria-labelledby="stay-connected-heading"
    >
      <div className="flex gap-3">
        <Image
          src="/branding/cogic-seal.png"
          alt=""
          width={48}
          height={48}
          priority
          loading="eager"
          className="h-12 w-12 shrink-0 object-contain"
        />
        <div className="min-w-0">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--cogic-gold,#C9A227)]">
            Stay connected
          </p>
          <h2
            id="stay-connected-heading"
            className="mt-1 text-base font-semibold uppercase tracking-[0.06em] text-white"
          >
            Receive alerts when
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
            <li>COGIC LIVE starts broadcasting</li>
            <li>Important announcements are posted</li>
            <li>Convocation schedule changes occur</li>
          </ul>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void turnOn()}
          className="brand-ombre-bg inline-flex min-h-11 items-center justify-center rounded-md px-4 text-xs font-bold uppercase tracking-[0.12em] text-white disabled:opacity-50"
        >
          {busy ? "Enabling…" : "Turn on notifications"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={notNow}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/25 px-4 text-xs font-bold uppercase tracking-[0.12em] text-white disabled:opacity-50"
        >
          Not now
        </button>
      </div>
    </section>
  );
}
