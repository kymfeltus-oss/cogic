import Link from "next/link";
import type { Registration } from "@/lib/registration/types";
import {
  honestSubmittedCopy,
  registrationReference,
  type RegistrationViewMode,
} from "@/lib/registration/workflow";

type RegistrationStatusPanelProps = {
  registration: Registration;
  viewMode: Exclude<RegistrationViewMode, "wizard" | "terminal">;
};

function statusTitle(viewMode: RegistrationStatusPanelProps["viewMode"]): string {
  if (viewMode === "submitted") return honestSubmittedCopy().title;
  if (viewMode === "payment_pending") {
    return "Registration payment is still pending";
  }
  return "Registration confirmed";
}

function statusBody(viewMode: RegistrationStatusPanelProps["viewMode"]): string {
  if (viewMode === "submitted") return honestSubmittedCopy().body;
  if (viewMode === "payment_pending") {
    return "Your registration information is on file. Payment processing is not available in this step yet.";
  }
  return "Your Convocation registration is confirmed.";
}

function statusLabel(viewMode: RegistrationStatusPanelProps["viewMode"]): string {
  if (viewMode === "submitted") return honestSubmittedCopy().statusLabel;
  if (viewMode === "payment_pending") return "Payment pending";
  return "Confirmed";
}

export default function RegistrationStatusPanel({
  registration,
  viewMode,
}: RegistrationStatusPanelProps) {
  const fullName = [registration.firstName, registration.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      className="registration-shell"
      aria-labelledby="registration-status-heading"
    >
      <p className="registration-kicker">Holy Convocation registration</p>
      <h1 id="registration-status-heading" className="registration-title">
        {statusTitle(viewMode)}
      </h1>
      <p className="registration-lead">{statusBody(viewMode)}</p>

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
      </dl>

      <p className="registration-note">
        No QR credential is issued at this stage. You will receive final confirmation
        when remaining registration requirements are completed.
      </p>

      <Link href="/attendee-dashboard" className="registration-btn registration-btn-primary">
        Back to dashboard
      </Link>
    </section>
  );
}
