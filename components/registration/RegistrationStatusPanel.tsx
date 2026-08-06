import Link from "next/link";
import type { Registration } from "@/lib/registration/types";
import {
  honestConfirmedCopy,
  honestPaymentPendingCopy,
  honestSubmittedCopy,
  registrationReference,
  type RegistrationViewMode,
} from "@/lib/registration/workflow";
import RegistrationCheckoutButton from "@/components/registration/RegistrationCheckoutButton";

type RegistrationStatusPanelProps = {
  registration: Registration;
  viewMode: Exclude<RegistrationViewMode, "wizard" | "terminal">;
  feeLabel?: string | null;
  checkoutCanceled?: boolean;
};

function statusTitle(viewMode: RegistrationStatusPanelProps["viewMode"]): string {
  if (viewMode === "submitted") return honestSubmittedCopy().title;
  if (viewMode === "payment_pending") return honestPaymentPendingCopy().title;
  return honestConfirmedCopy().title;
}

function statusBody(
  viewMode: RegistrationStatusPanelProps["viewMode"],
  feeLabel: string | null | undefined,
): string {
  if (viewMode === "submitted") {
    const base = honestSubmittedCopy().body;
    return feeLabel ? `${base} Registration fee: ${feeLabel}.` : base;
  }
  if (viewMode === "payment_pending") {
    const base = honestPaymentPendingCopy().body;
    return feeLabel ? `${base} Amount due: ${feeLabel}.` : base;
  }
  return honestConfirmedCopy().body;
}

function statusLabel(viewMode: RegistrationStatusPanelProps["viewMode"]): string {
  if (viewMode === "submitted") return honestSubmittedCopy().statusLabel;
  if (viewMode === "payment_pending") return honestPaymentPendingCopy().statusLabel;
  return honestConfirmedCopy().statusLabel;
}

export default function RegistrationStatusPanel({
  registration,
  viewMode,
  feeLabel = null,
  checkoutCanceled = false,
}: RegistrationStatusPanelProps) {
  const fullName = [registration.firstName, registration.lastName]
    .filter(Boolean)
    .join(" ");
  const needsPayment = viewMode === "submitted" || viewMode === "payment_pending";
  const isConfirmed = viewMode === "confirmed";

  return (
    <section
      className="registration-shell"
      aria-labelledby="registration-status-heading"
    >
      <p className="registration-kicker">Holy Convocation registration</p>
      <h1 id="registration-status-heading" className="registration-title">
        {statusTitle(viewMode)}
      </h1>
      <p className="registration-lead">{statusBody(viewMode, feeLabel)}</p>

      {checkoutCanceled ? (
        <p className="registration-note" role="status">
          Checkout was canceled. Your registration information is still saved — you can
          resume payment when ready.
        </p>
      ) : null}

      <dl className="registration-summary" aria-label="Registration summary">
        <div>
          <dt>Status</dt>
          <dd>{statusLabel(viewMode)}</dd>
        </div>
        <div>
          <dt>Reference</dt>
          <dd>{registrationReference(registration)}</dd>
        </div>
        <div>
          <dt>Name</dt>
          <dd>{fullName || "—"}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{registration.email || "—"}</dd>
        </div>
        <div>
          <dt>Church</dt>
          <dd>{registration.churchName || "—"}</dd>
        </div>
        <div>
          <dt>Jurisdiction</dt>
          <dd>{registration.jurisdiction || "—"}</dd>
        </div>
        {feeLabel ? (
          <div>
            <dt>Registration fee</dt>
            <dd>{feeLabel}</dd>
          </div>
        ) : null}
      </dl>

      {needsPayment ? (
        <>
          <p className="registration-note">
            Complete Stripe Checkout to confirm registration. Your QR credential is issued
            only after payment is confirmed by the server webhook — not by returning from
            Checkout alone.
          </p>
          {feeLabel ? (
            <RegistrationCheckoutButton label={`Pay ${feeLabel} — Continue to Checkout`} />
          ) : (
            <p className="registration-field-error" role="alert">
              Registration payment is temporarily unavailable because pricing is not
              configured. Contact support if this continues.
            </p>
          )}
        </>
      ) : null}

      {isConfirmed ? (
        <p className="registration-note">
          Your registration is confirmed. Open My Convocation to access your credential
          when it is ready.
        </p>
      ) : null}

      <div className="registration-actions">
        <Link href="/my-convocation" className="registration-btn registration-btn-primary">
          {isConfirmed ? "Go to My Convocation" : "Back to My Convocation"}
        </Link>
      </div>
    </section>
  );
}
