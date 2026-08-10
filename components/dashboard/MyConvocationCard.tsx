"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, ClipboardList } from "lucide-react";
import IconBadge from "@/components/brand/IconBadge";
import { registrationHeadline } from "@/lib/dashboard/dashboard-module-summaries";
import type { DashboardRegistrationState } from "@/lib/dashboard/load-attendee-dashboard";

const label = (value: string | null) => (value || "unavailable").replaceAll("_", " ");

/**
 * Compact My Convocation teaser — full registration detail lives at
 * /my-convocation/registration (single attendee registration experience).
 */
export default function MyConvocationCard({
  registration,
  signedIn,
}: {
  registration: DashboardRegistrationState;
  signedIn: boolean;
}) {
  const headline = registrationHeadline(registration, signedIn);

  if (!signedIn || registration.status === "none") {
    return (
      <article className="cl-section cl-section--registration">
        <header className="cl-section__head">
          <div>
            <p className="cl-section__eyebrow">My Registration</p>
            <h2 className="cl-section__title">{headline.title}</h2>
          </div>
          <IconBadge icon={ClipboardList} />
        </header>
        <p className="cl-section__body">{headline.summary}</p>
        <Link href={headline.href} className="cl-btn cl-btn--primary cl-btn--block">
          {headline.cta}
          <ArrowRight aria-hidden="true" />
        </Link>
      </article>
    );
  }

  const credentialPending = registration.status === "confirmed" && !registration.credentialReady;

  return (
    <article className="cl-section cl-section--registration">
      <header className="cl-section__head">
        <div>
          <p className="cl-section__eyebrow">My Registration</p>
          <h2 className="cl-section__title">{headline.title}</h2>
        </div>
        <IconBadge icon={registration.credentialReady ? BadgeCheck : ClipboardList} />
      </header>
      <p className="cl-reg-badge">{label(registration.status)}</p>
      <p className="cl-section__body">{headline.summary}</p>
      {credentialPending ? (
        <p className="cl-reg-credential-note" role="status">
          Credential Pending
        </p>
      ) : null}

      <dl className="cl-reg-summary">
        <div>
          <dt>Status</dt>
          <dd className="capitalize">{label(registration.status)}</dd>
        </div>
        <div>
          <dt>Payment</dt>
          <dd className="capitalize">{label(registration.paymentStatus)}</dd>
        </div>
        <div>
          <dt>Product</dt>
          <dd>{registration.productName || "—"}</dd>
        </div>
        <div>
          <dt>Group</dt>
          <dd>
            {registration.members.length || registration.groupSize} member
            {(registration.members.length || registration.groupSize) === 1 ? "" : "s"}
          </dd>
        </div>
      </dl>

      {!registration.policyAccepted ? (
        <div className="cl-reg-policy cl-reg-policy--warn" role="status">
          <span>! Policy agreement pending.</span>
        </div>
      ) : (
        <div className="cl-reg-policy cl-reg-policy--ok">
          <span>Policy accepted</span>
        </div>
      )}

      <Link href={headline.href} className="cl-btn cl-btn--primary cl-btn--block">
        {headline.cta}
        <ArrowRight aria-hidden="true" />
      </Link>
    </article>
  );
}
