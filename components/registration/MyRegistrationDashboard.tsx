"use client";

import { useState } from "react";
import Link from "next/link";
import RegistrationPolicyDocument from "@/components/registration/RegistrationPolicyDocument";
import type { MyRegistrationDashboard as DashboardData } from "@/lib/registration/load-my-registration";

const label = (value: string | null | undefined) =>
  (value || "—").replaceAll("_", " ");

const profileLabels: Record<string, string> = {
  salutation: "Salutation",
  firstName: "First name",
  lastName: "Last name",
  suffix: "Suffix",
  email: "Email",
  mobilePhone: "Mobile phone",
  assistantEmail: "Assistant email",
  country: "Country",
  addressLine1: "Address line 1",
  addressLine2: "Address line 2",
  city: "City",
  state: "State/province",
  postalCode: "Postal code",
  gender: "Gender",
  churchName: "Church name",
  pastorName: "Pastor name",
  jurisdiction: "Jurisdiction",
  interpretation: "Interpretation requirement",
  preferredLanguage: "Preferred language",
  registrationProduct: "Registration product",
  productPrice: "Product price",
};

export default function MyRegistrationDashboard({
  initialData,
}: {
  initialData: DashboardData;
}) {
  const [data, setData] = useState(initialData);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [policyOpen, setPolicyOpen] = useState(false);
  const [credential, setCredential] = useState<{
    name: string;
    status: string;
    type: string;
    qrDataUrl: string;
  } | null>(null);

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/registration/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to refresh registration.");
      setData(await response.json());
      setMessage("Registration updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh registration.");
    } finally {
      setBusy(false);
    }
  }

  async function showCredential(registrationId: string, name: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/registration/credential-presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Credential unavailable.");
      setCredential({
        name,
        status: result.status,
        type: result.registrationType,
        qrDataUrl: result.qrDataUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Credential unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(registrationId: string) {
    if (!confirm("Remove this group member from the draft registration?")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/registration/experience?id=${encodeURIComponent(registrationId)}`,
        { method: "DELETE" },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to remove registrant.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove registrant.");
      setBusy(false);
    }
  }

  if (data.state === "error") {
    return (
      <section className="mr-shell">
        <article className="mr-panel">
          <h2>Unable to load registration</h2>
          <p className="mr-error" role="alert">
            {data.error || "Something went wrong."}
          </p>
          <button type="button" className="mr-btn mr-btn--primary" onClick={() => void refresh()}>
            Try again
          </button>
        </article>
      </section>
    );
  }

  if (data.state === "none" || data.state === "unauthorized") {
    return (
      <section className="mr-shell">
        <article className="mr-panel mr-empty">
          <h2>No registration yet</h2>
          <p className="mr-muted">
            You do not have a Holy Convocation registration for this program. Start registration to
            select your product, add group members, and complete payment.
          </p>
          <Link href="/register" className="mr-btn mr-btn--primary">
            Register for Holy Convocation
          </Link>
        </article>
      </section>
    );
  }

  const primaryActions = data.nextActions.slice(0, 4);

  return (
    <section className="mr-shell">
      {error ? (
        <p className="mr-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mr-muted" role="status">
          {message}
        </p>
      ) : null}

      <article className="mr-panel">
        <h2>Registration summary</h2>
        <dl className="mr-summary-grid">
          <div>
            <dt>Registration status</dt>
            <dd>{label(data.summary.status)}</dd>
          </div>
          <div>
            <dt>Registration product</dt>
            <dd>{data.summary.productName || "—"}</dd>
          </div>
          <div>
            <dt>Product price</dt>
            <dd>{data.summary.productPriceLabel}</dd>
          </div>
          <div>
            <dt>Amount paid</dt>
            <dd>{data.summary.amountPaidLabel}</dd>
          </div>
          <div>
            <dt>Remaining balance</dt>
            <dd>{data.summary.remainingBalanceLabel}</dd>
          </div>
          <div>
            <dt>Payment status</dt>
            <dd>{label(data.summary.paymentStatus)}</dd>
          </div>
          <div>
            <dt>Credential status</dt>
            <dd>{label(data.summary.credentialStatus)}</dd>
          </div>
          <div>
            <dt>Group members</dt>
            <dd>{data.summary.groupMemberCount}</dd>
          </div>
          <div>
            <dt>Housing status</dt>
            <dd>{label(data.summary.housingStatus || data.summary.housingPreference)}</dd>
          </div>
          <div>
            <dt>Total registration</dt>
            <dd>{data.summary.totalAmountLabel}</dd>
          </div>
        </dl>
        <p className="mr-muted" style={{ marginTop: "0.85rem" }}>
          Housing costs are not included in registration totals. Payment confirmation comes from
          Stripe webhook fulfillment, not the browser redirect.
        </p>
      </article>

      <div className="mr-two-col">
        <article className="mr-panel">
          <h2>Next steps</h2>
          <div className="mr-actions">
            {primaryActions.map((action, index) => (
              <Link
                key={action.id}
                href={action.href}
                className={`mr-action${index === 0 ? " mr-action--primary" : ""}`}
              >
                <strong>{action.label}</strong>
                <small>{action.reason}</small>
              </Link>
            ))}
          </div>
        </article>

        <article className="mr-panel">
          <h2>Registration journey</h2>
          <div className="mr-journey" aria-label="Registration progress">
            {data.journey.map((step) => (
              <div key={step.id} className="mr-journey__step" data-state={step.state}>
                <span className="mr-journey__dot" aria-hidden="true" />
                <div>
                  <strong>{step.label}</strong>
                  <p className="mr-muted" style={{ margin: 0, textTransform: "capitalize" }}>
                    {step.state}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      {data.blockers.length ? (
        <article className="mr-panel">
          <h2>Group readiness / blockers</h2>
          <div className="mr-blockers">
            {data.blockers.map((blocker) => (
              <div key={blocker.id} className="mr-blocker">
                {blocker.label}
              </div>
            ))}
          </div>
        </article>
      ) : null}

      <article className="mr-panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>My registration information</h2>
          {data.editable ? (
            <Link href="/register" className="mr-btn mr-btn--primary">
              Edit Registration Information
            </Link>
          ) : (
            <span className="mr-muted">Profile edits are available while registration is in draft.</span>
          )}
        </div>
        <dl className="mr-fields" style={{ marginTop: "1rem" }}>
          {Object.entries(profileLabels).map(([key, title]) => (
            <div key={key}>
              <dt>{title}</dt>
              <dd>{data.profile[key] || "—"}</dd>
            </div>
          ))}
        </dl>
      </article>

      <article className="mr-panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Group / junior registrants</h2>
          {data.editable ? (
            <Link href="/register" className="mr-btn">
              Add group/junior registrant
            </Link>
          ) : null}
        </div>
        <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.85rem" }}>
          {data.members.map((member) => (
            <article key={member.registrationId} className="mr-member">
              <div>
                <strong>{member.name}</strong>
                <p className="mr-muted" style={{ margin: "0.2rem 0 0" }}>
                  {member.relationship}
                  {member.isJunior ? " · Junior" : ""}
                  {member.productName ? ` · ${member.productName}` : ""}
                </p>
              </div>
              <p className="mr-muted" style={{ margin: 0 }}>
                Status {label(member.status)} · Payment {label(member.paymentState)} · Credential{" "}
                {label(member.credentialStatus)}
                {member.dateOfBirth ? ` · DOB ${member.dateOfBirth}` : member.isJunior ? " · DOB missing" : ""}
              </p>
              <div className="mr-member__actions">
                {member.canPresentCredential ? (
                  <button
                    type="button"
                    className="mr-btn mr-btn--primary"
                    disabled={busy}
                    onClick={() => void showCredential(member.registrationId, member.name)}
                  >
                    View Credential
                  </button>
                ) : null}
                {member.canEdit ? (
                  <Link href="/register" className="mr-btn">
                    Edit
                  </Link>
                ) : null}
                {member.canRemove ? (
                  <button
                    type="button"
                    className="mr-btn mr-btn--danger"
                    disabled={busy}
                    onClick={() => void removeMember(member.registrationId)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </article>

      <article className="mr-panel" id="payments">
        <h2>Payments & receipts</h2>
        <p className="mr-muted">
          Total {data.summary.totalAmountLabel} · Paid {data.summary.amountPaidLabel} · Remaining{" "}
          {data.summary.remainingBalanceLabel}
        </p>
        <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.85rem" }}>
          {data.payments.length ? (
            data.payments.map((payment) => (
              <article key={payment.id} className="mr-payment">
                <strong>{payment.description}</strong>
                <p className="mr-muted" style={{ margin: 0 }}>
                  {payment.createdAt
                    ? new Date(payment.createdAt).toLocaleString()
                    : "Date unavailable"}{" "}
                  · {payment.amountLabel} · {label(payment.status)}
                </p>
                {payment.stripeReference ? (
                  <p className="mr-muted" style={{ margin: 0 }}>
                    Stripe reference {payment.stripeReference}
                  </p>
                ) : null}
              </article>
            ))
          ) : (
            <p className="mr-muted">No registration payment records yet.</p>
          )}
        </div>
      </article>

      <article className="mr-panel" id="credentials">
        <h2>Credential / QR</h2>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {data.credentials.map((item) => (
            <article key={item.registrationId} className="mr-credential">
              <strong>{item.name}</strong>
              <p className="mr-muted" style={{ margin: 0 }}>
                Status {label(item.status)}
                {item.badgeCodeMasked ? ` · Badge ${item.badgeCodeMasked}` : ""}
              </p>
              <p className="mr-muted" style={{ margin: 0 }}>
                Issued {item.issuedAt ? new Date(item.issuedAt).toLocaleString() : "—"}
                {item.rotatedAt ? ` · Rotated ${new Date(item.rotatedAt).toLocaleString()}` : ""}
              </p>
              <p className="mr-muted" style={{ margin: 0 }}>
                {item.message}
              </p>
              <div className="mr-credential__actions">
                {item.canPresent ? (
                  <button
                    type="button"
                    className="mr-btn mr-btn--primary"
                    disabled={busy}
                    onClick={() => void showCredential(item.registrationId, item.name)}
                  >
                    View Credential / QR
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </article>

      <article className="mr-panel">
        <h2>Policy & agreements</h2>
        {data.policy.accepted ? (
          <>
            <p className="mr-muted">
              Accepted version {data.policy.version || "—"}
              {data.policy.signerName ? ` · Signer ${data.policy.signerName}` : ""}
              {data.policy.acceptedAt
                ? ` · ${new Date(data.policy.acceptedAt).toLocaleString()}`
                : ""}
            </p>
            <button type="button" className="mr-btn" onClick={() => setPolicyOpen(true)}>
              View accepted policy
            </button>
          </>
        ) : (
          <>
            <p className="mr-muted" role="status">
              Required policy acceptance is incomplete
              {data.policy.version ? ` (current version ${data.policy.version})` : ""}.
            </p>
            <Link href={data.policy.acceptHref} className="mr-btn mr-btn--primary">
              Review/accept required policy
            </Link>
          </>
        )}
      </article>

      <div className="mr-two-col">
        <article className="mr-panel">
          <h2>Housing</h2>
          <p className="mr-muted">{data.housing.summary}</p>
          <p className="mr-muted">
            {data.housing.hotelName || data.housing.blockName || label(data.housing.preference)}
            {data.housing.arrival || data.housing.departure
              ? ` · ${data.housing.arrival || "—"} to ${data.housing.departure || "—"}`
              : ""}
          </p>
          <p className="mr-muted">Housing remains financially separate from registration.</p>
          <Link href={data.housing.href} className="mr-btn">
            Open housing
          </Link>
        </article>

        <article className="mr-panel">
          <h2>Travel</h2>
          <p className="mr-muted">
            {data.travel.hasActivity
              ? "You have travel activity on My Trip."
              : "Plan hotels, flights, and cars in COGIC Travel when you are ready."}
          </p>
          <Link href={data.travel.href} className="mr-btn">
            View My Trip
          </Link>
        </article>
      </div>

      {(data.state === "canceled" || data.state === "refunded") && (
        <article className="mr-panel">
          <h2>{data.state === "canceled" ? "Registration canceled" : "Registration refunded"}</h2>
          <p className="mr-muted">
            This registration is not active. Credentials are not usable for entry from this
            registration. You may start a new registration if eligible.
          </p>
          <div className="mr-member__actions">
            <Link href="/register" className="mr-btn mr-btn--primary">
              Start a new registration
            </Link>
            <Link href="/contact-us" className="mr-btn">
              Contact support
            </Link>
          </div>
        </article>
      )}

      <div className="mr-member__actions">
        <button type="button" className="mr-btn" disabled={busy} onClick={() => void refresh()}>
          {busy ? "Refreshing…" : "Refresh status"}
        </button>
        <Link href="/my-convocation" className="mr-btn">
          Back to My Convocation
        </Link>
      </div>

      {policyOpen && data.policy.snapshot ? (
        <div className="mr-modal" role="dialog" aria-modal="true" aria-label="Accepted policy">
          <div className="mr-modal__card" style={{ textAlign: "left", maxHeight: "90vh", overflow: "auto" }}>
            <button type="button" className="mr-btn" onClick={() => setPolicyOpen(false)}>
              Close
            </button>
            <RegistrationPolicyDocument
              title="Accepted Registration Policy"
              version={data.policy.version || ""}
              content={data.policy.snapshot}
            />
          </div>
        </div>
      ) : null}

      {credential ? (
        <div className="mr-modal" role="dialog" aria-modal="true" aria-label={`${credential.name} credential`}>
          <div className="mr-modal__card">
            <button type="button" className="mr-btn" onClick={() => setCredential(null)}>
              Close
            </button>
            <h2>My Credential</h2>
            <p>{credential.name}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={credential.qrDataUrl} alt={`${credential.name} secure entry QR code`} />
            <strong>{credential.type}</strong>
            <p>Credential {label(credential.status)}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
