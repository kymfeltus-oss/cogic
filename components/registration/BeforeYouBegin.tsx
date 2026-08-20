"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BeforeYouBegin({ groupVersion }: { groupVersion: number | null }) {
  const router = useRouter();
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function continueRegistration() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/registration/experience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "acknowledge_before_you_begin",
        versions: { groupVersion },
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(body.error ?? "Unable to save your acknowledgment.");
      setBusy(false);
      return;
    }
    router.replace("/register?step=attendee");
    router.refresh();
  }

  return (
    <section className="registration-shell" aria-labelledby="before-you-begin-title">
      <p className="registration-kicker">118th Holy Convocation</p>
      <h1 id="before-you-begin-title" className="registration-title">Before You Begin</h1>
      <div className="grid gap-4 leading-7">
        <p>Registration is for the 118th Holy Convocation in St. Louis, Missouri, November 3–10, 2026.</p>
        <p>Have each attendee’s contact information, registration selection, and any child’s date of birth ready before continuing.</p>
        <section className="rounded border border-yellow-400/30 p-4">
          <h2 className="font-bold">Registration pickup</h2>
          <p>Badges, gifts, and printed materials are distributed at the official Holy Convocation registration pickup location during published registration hours. Bring photo identification and your confirmation.</p>
          <p>Reserved seating is held only until 15 minutes after an applicable service begins.</p>
        </section>
        <p>This informational acknowledgment does not replace the formal registration policy agreement later in the process.</p>
        <label className="flex items-start gap-3 rounded border border-white/15 p-4">
          <input className="mt-1 h-5 w-5" type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
          <span>I have read and understand the registration information above.</span>
        </label>
        {error ? <p role="alert" className="registration-error-summary">{error}</p> : null}
        <button className="registration-btn registration-btn-primary" type="button" disabled={!acknowledged || busy} onClick={() => void continueRegistration()}>
          {busy ? "Saving…" : "Continue to attendee information"}
        </button>
      </div>
    </section>
  );
}
