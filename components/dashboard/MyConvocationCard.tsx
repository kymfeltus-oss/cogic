"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, ClipboardList, QrCode, X } from "lucide-react";
import IconBadge from "@/components/brand/IconBadge";
import RegistrationPolicyDocument from "@/components/registration/RegistrationPolicyDocument";
import { registrationHeadline } from "@/lib/dashboard/dashboard-module-summaries";
import type { DashboardRegistrationState } from "@/lib/dashboard/load-attendee-dashboard";
import { credentialPresentationCopy } from "@/lib/registration/credential-presentation-state";

const label = (value: string | null) => (value || "unavailable").replaceAll("_", " ");

function formatDate(value: string | null) {
  if (!value) return "Unavailable";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MyConvocationCard({
  registration,
  signedIn,
}: {
  registration: DashboardRegistrationState;
  signedIn: boolean;
}) {
  const [policyOpen, setPolicyOpen] = useState(false);
  const [credential, setCredential] = useState<{
    memberId: string;
    name: string;
    type: string;
    status: string;
    qrDataUrl: string;
  } | null>(null);
  const [credentialError, setCredentialError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const headline = registrationHeadline(registration, signedIn);

  async function showCredential(member: DashboardRegistrationState["members"][number]) {
    setCredentialError("");
    setBusyId(member.registrationId);
    try {
      const response = await fetch("/api/registration/credential-presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: member.registrationId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Credential unavailable.");
      setCredential({
        memberId: member.registrationId,
        name: member.name,
        type: result.registrationType,
        status: result.status,
        qrDataUrl: result.qrDataUrl,
      });
    } catch (error) {
      setCredentialError(error instanceof Error ? error.message : "Credential unavailable.");
    } finally {
      setBusyId(null);
    }
  }

  if (!signedIn || registration.status === "none") {
    return (
      <article className="cl-section cl-section--registration">
        <header className="cl-section__head">
          <div>
            <p className="cl-section__eyebrow">Registration</p>
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

  const statusLabel = label(registration.status);
  const credentialPending =
    registration.status === "confirmed" && !registration.credentialReady;

  return (
    <article className="cl-section cl-section--registration">
      <header className="cl-section__head">
        <div>
          <p className="cl-section__eyebrow">Registration</p>
          <h2 className="cl-section__title">{headline.title}</h2>
        </div>
        <IconBadge icon={registration.credentialReady ? BadgeCheck : ClipboardList} />
      </header>
      <p className="cl-reg-badge">{statusLabel}</p>
      <p className="cl-section__body">{headline.summary}</p>
      {credentialPending ? (
        <p className="cl-reg-credential-note" role="status">
          Credential Pending
        </p>
      ) : null}

      <dl className="cl-reg-summary">
        <div>
          <dt>Registration</dt>
          <dd className="capitalize">{statusLabel}</dd>
        </div>
        <div>
          <dt>Payment</dt>
          <dd className="capitalize">{label(registration.paymentStatus)}</dd>
        </div>
        <div>
          <dt>Registered</dt>
          <dd>{formatDate(registration.registeredAt)}</dd>
        </div>
        <div>
          <dt>Group</dt>
          <dd>
            {registration.members.length} member
            {registration.members.length === 1 ? "" : "s"}
          </dd>
        </div>
      </dl>

      <div className="cl-reg-members">
        <h3>Group Members</h3>
        <ul>
          {registration.members.map((member) => {
            const credentialState = credentialPresentationCopy(member.credentialStatus);
            return (
              <li key={member.registrationId}>
                <div className="cl-reg-member-row">
                  <div>
                    <strong>{member.name}</strong>
                    <span className="capitalize">
                      {label(member.relationship)}
                      {member.isJunior?" · Junior":""}
                    </span>
                  </div>
                  <em>{credentialState.label}</em>
                </div>
                {credentialState.canPresent ? (
                  <button
                    type="button"
                    className="cl-reg-credential-btn"
                    disabled={busyId === member.registrationId}
                    onClick={() => void showCredential(member)}
                  >
                    <QrCode aria-hidden="true" />
                    {busyId === member.registrationId ? "Preparing…" : "Show Credential"}
                  </button>
                ) : (
                  <p className="cl-reg-credential-note">{credentialState.message}</p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {registration.policy ? (
        <div className="cl-reg-policy cl-reg-policy--ok">
          <span>
            Policy accepted · Version {registration.policy.version}
          </span>
          <button type="button" className="cl-text-link" onClick={() => setPolicyOpen(true)}>
            View
          </button>
          <span className="cl-reg-policy__meta">
            {new Date(registration.policy.acceptedAt).toLocaleString()} ·{" "}
            {registration.policy.signerName}
          </span>
        </div>
      ) : (
        <div className="cl-reg-policy cl-reg-policy--warn" role="status">
          <span>! Policy agreement pending.</span>
        </div>
      )}

      {credentialError ? (
        <p role="alert" className="cl-reg-error">
          {credentialError}
        </p>
      ) : null}

      <Link href={headline.href} className="cl-btn cl-btn--primary cl-btn--block">
        {headline.cta}
        <ArrowRight aria-hidden="true" />
      </Link>

      {policyOpen && registration.policy ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Accepted policy"
          className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-[#0b0715] p-6">
            <button aria-label="Close policy" className="float-right" onClick={() => setPolicyOpen(false)}>
              <X />
            </button>
            <RegistrationPolicyDocument
              title="Accepted Registration Policy"
              version={registration.policy.version}
              content={registration.policy.snapshot}
            />
          </div>
        </div>
      ) : null}

      {credential ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${credential.name} credential`}
          className="fixed inset-0 z-[100] grid place-items-center bg-black/95 p-3"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 text-center text-[#07040F]">
            <button aria-label="Close credential" className="float-right" onClick={() => setCredential(null)}>
              <X />
            </button>
            <h2 className="text-2xl font-bold">My Credential</h2>
            <p>{credential.name}</p>
            <img
              src={credential.qrDataUrl}
              alt={`${credential.name} secure entry QR code`}
              className="mx-auto my-4 aspect-square w-full max-w-[420px]"
            />
            <strong>{credential.type}</strong>
            <p className="capitalize">Credential {label(credential.status)}</p>
          </div>
        </div>
      ) : null}
    </article>
  );
}
