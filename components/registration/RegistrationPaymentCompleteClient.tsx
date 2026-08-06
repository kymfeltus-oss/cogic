"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
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

      <div className="registration-actions">
        <Link href="/my-convocation" className="registration-btn registration-btn-primary">
          Go to My Convocation
        </Link>
        {!confirmed ? (
          <Link href="/register/review" className="registration-btn registration-btn-secondary">
            Review registration
          </Link>
        ) : null}
      </div>
    </section>
  );
}
