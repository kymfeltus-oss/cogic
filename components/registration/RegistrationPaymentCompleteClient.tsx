"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Registration } from "@/lib/registration/types";
import {
  honestConfirmedCopy,
  honestPaymentPendingCopy,
  registrationReference,
} from "@/lib/registration/workflow";

type RegistrationPaymentCompleteClientProps = {
  registration: Registration;
  feeLabel: string | null;
};

export default function RegistrationPaymentCompleteClient({
  registration,
  feeLabel,
}: RegistrationPaymentCompleteClientProps) {
  const router = useRouter();
  const [hotel, setHotel] = useState<{hotel_name_snapshot:string;check_in:string;check_out:string}|null>(null);
  const confirmed = registration.status === "confirmed";
  const pending =
    registration.status === "payment_pending" || registration.status === "submitted";

  useEffect(() => {
    if (confirmed) return;
    const timer = window.setInterval(() => {
      router.refresh();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [confirmed, router]);

  useEffect(() => {
    if (!confirmed) return;
    void fetch("/api/travel/reservations", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((state) => setHotel(state?.primary ?? null));
  }, [confirmed]);

  const copy = confirmed ? honestConfirmedCopy() : honestPaymentPendingCopy();

  return (
    <section
      className="registration-shell"
      aria-labelledby="registration-payment-complete-heading"
      aria-live="polite"
    >
      <p className="registration-kicker">Holy Convocation registration</p>
      <h1 id="registration-payment-complete-heading" className="registration-title">
        {confirmed ? copy.title : "Confirming your payment"}
      </h1>
      <p className="registration-lead">
        {confirmed
          ? copy.body
          : "Stripe Checkout completed. We are waiting for the secure payment webhook to confirm your registration. This page refreshes automatically."}
      </p>

      <dl className="registration-summary" aria-label="Registration summary">
        <div>
          <dt>Status</dt>
          <dd>{confirmed ? copy.statusLabel : pending ? "Confirming payment…" : registration.status}</dd>
        </div>
        <div>
          <dt>Reference</dt>
          <dd>{registrationReference(registration)}</dd>
        </div>
        {feeLabel ? (
          <div>
            <dt>Registration fee</dt>
            <dd>{feeLabel}</dd>
          </div>
        ) : null}
      </dl>

      {!confirmed ? (
        <p className="registration-loading" role="status">
          Waiting for payment confirmation…
        </p>
      ) : null}

      {confirmed ? <div className="mt-8 rounded-2xl border border-white/15 p-5"><h2 className="text-2xl font-bold">{hotel?"Your Hotel Is Reserved ✓":"Next: Plan Your Trip"}</h2><p className="mt-2">{hotel?`${hotel.hotel_name_snapshot} · ${hotel.check_in} – ${hotel.check_out}`:"Now let's plan your trip to St. Louis."}</p><div className="registration-actions">{hotel?<Link href="/travel/trip" className="registration-btn registration-btn-primary">Open My Trip</Link>:<Link href="/travel/hotels" className="registration-btn registration-btn-primary">Find an Official Hotel</Link>}<Link href="/travel" className="registration-btn registration-btn-secondary">Open COGIC Travel</Link><Link href="/travel/trip" className="registration-btn registration-btn-secondary">Add Trip Details</Link><Link href="/program" className="registration-btn registration-btn-secondary">Build My Convocation</Link></div></div>:null}
      <div className="registration-actions">
        <Link href={confirmed?"/travel":"/my-convocation"} className="registration-btn registration-btn-primary">{confirmed?"Plan My Trip":"Go to My Convocation"}</Link>
        {confirmed?<Link href="/my-convocation" className="registration-btn registration-btn-secondary">I&apos;ll Do This Later</Link>:null}
        {!confirmed ? (
          <Link href="/register/review" className="registration-btn registration-btn-secondary">
            Review registration
          </Link>
        ) : null}
      </div>
    </section>
  );
}
