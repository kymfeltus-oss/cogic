"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import RegistrationCheckoutButton from "@/components/registration/RegistrationCheckoutButton";
import {
  formatRegistrationAmount,
  getGroupTotalCents,
  getPrimaryRegistrant,
  getRegistrationProduct,
  type RegistrationExperience,
} from "@/lib/registration/group-experience";

type RegistrationGroupStatusProps = {
  experience: RegistrationExperience;
  checkoutCanceled?: boolean;
  paymentComplete?: boolean;
};

function statusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "In progress";
    case "submitted":
      return "Awaiting payment";
    case "payment_pending":
      return "Payment processing";
    case "confirmed":
      return "Confirmed";
    case "canceled":
      return "Canceled";
    case "refunded":
      return "Refunded";
    default:
      return status;
  }
}

export default function RegistrationGroupStatus({
  experience,
  checkoutCanceled = false,
  paymentComplete = false,
}: RegistrationGroupStatusProps) {
  const router = useRouter();
  const group = experience.group;
  const primary = getPrimaryRegistrant(group);
  const totalCents = getGroupTotalCents(group);
  const isConfirmed = group?.status === "confirmed";
  const isProcessing = group?.status === "payment_pending";

  useEffect(() => {
    if (!isProcessing || isConfirmed) {
      return undefined;
    }

    const timer = window.setInterval(() => router.refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [isConfirmed, isProcessing, router]);

  if (!group || !primary) {
    return (
      <section className="registration-shell" aria-labelledby="registration-review-heading">
        <p className="registration-kicker">Holy Convocation registration</p>
        <h1 id="registration-review-heading" className="registration-title">
          Registration not started
        </h1>
        <p className="registration-lead">Start your attendee registration before reviewing payment.</p>
        <Link href="/register" className="registration-btn registration-btn-primary">
          Start registration
        </Link>
      </section>
    );
  }

  const paymentHeading = paymentComplete ? "Confirming your payment" : "Review registration";
  const heading = isConfirmed ? "Registration confirmed" : paymentHeading;

  return (
    <section className="registration-shell" aria-labelledby="registration-review-heading" aria-live="polite">
      <p className="registration-kicker">Holy Convocation registration</p>
      <h1 id="registration-review-heading" className="registration-title">
        {heading}
      </h1>
      {checkoutCanceled ? (
        <p className="registration-field-error" role="status">
          Checkout was canceled. Your registration is still saved and ready when you are.
        </p>
      ) : null}
      {isProcessing ? (
        <p className="registration-lead">
          We are waiting for Stripe&apos;s secure payment confirmation. This page refreshes automatically.
        </p>
      ) : null}
      {isConfirmed ? (
        <p className="registration-lead">
          Your registration is confirmed. Individual attendee credentials are issued from this confirmed group.
        </p>
      ) : null}
      {group.status === "canceled" ? (
        <p className="registration-lead">This registration was canceled. Please contact the registration team for next steps.</p>
      ) : null}

      <dl className="registration-summary" aria-label="Registration group summary">
        <div>
          <dt>Group status</dt>
          <dd>{statusLabel(group.status)}</dd>
        </div>
        <div>
          <dt>Registration total</dt>
          <dd>{formatRegistrationAmount(totalCents, primary.currency ?? "usd")}</dd>
        </div>
        <div>
          <dt>Primary attendee</dt>
          <dd>
            {primary.first_name} {primary.last_name}
          </dd>
        </div>
      </dl>

      <div className="grid gap-2">
        {group.registrations.map((registrant) => {
          const product = getRegistrationProduct(experience.products, registrant.registration_product_id);
          const amount =
            registrant.is_primary_registrant && group.status !== "draft"
              ? totalCents
              : registrant.amount_cents ?? product?.price_cents ?? 0;
          return (
            <article key={registrant.id} className="rounded border border-white/10 p-3">
              <strong>
                {registrant.first_name} {registrant.last_name}
              </strong>
              <p className="text-sm text-white/70">
                {registrant.is_primary_registrant ? "Primary attendee" : registrant.relationship_to_primary ?? "Group attendee"}
              </p>
              <p className="text-sm">
                {product?.name ?? "Registration product"} · {formatRegistrationAmount(amount, registrant.currency ?? product?.currency ?? "usd")}
              </p>
            </article>
          );
        })}
      </div>

      <p className="registration-lead">
        Housing deposits are separate from registration payment and are never included in this total.
      </p>

      {group.status === "draft" ? (
        <div className="registration-actions">
          <Link href="/register" className="registration-btn registration-btn-primary">
            Continue registration
          </Link>
        </div>
      ) : null}

      {group.status === "submitted" ? (
        <div className="registration-actions">
          <RegistrationCheckoutButton label={`Pay ${formatRegistrationAmount(totalCents, primary.currency ?? "usd")}`} />
          <Link href="/register" className="registration-btn registration-btn-secondary">
            Back to registration
          </Link>
        </div>
      ) : null}

      {isProcessing ? (
        <div className="registration-actions">
          <RegistrationCheckoutButton label="Resume payment" />
          <button type="button" className="registration-btn registration-btn-secondary" onClick={() => router.refresh()}>
            Check payment status
          </button>
        </div>
      ) : null}

      {isConfirmed ? (
        <div className="registration-actions">
          <Link href="/my-convocation" className="registration-btn registration-btn-primary">
            Go to My Convocation
          </Link>
          <Link href="/travel" className="registration-btn registration-btn-secondary">
            Plan My Trip
          </Link>
          <Link href="/program" className="registration-btn registration-btn-secondary">
            Build My Convocation
          </Link>
        </div>
      ) : null}
    </section>
  );
}
