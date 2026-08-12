"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BedDouble,
  CircleHelp,
  CreditCard,
  FileText,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  Ticket,
  UserRound,
  UsersRound,
} from "lucide-react";
import RegistrationPolicyDocument from "@/components/registration/RegistrationPolicyDocument";
import type { MyRegistrationDashboard as DashboardData } from "@/lib/registration/load-my-registration";

const TRAVEL_TRIP_PATH = "/travel/trip";

const label = (value: string | null | undefined) => (value || "—").replaceAll("_", " ");

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

type HubCardState = "complete" | "current" | "upcoming";

type HubCard = {
  id: string;
  title: string;
  description: string;
  action: string;
  href: string;
  state: HubCardState;
  icon: LucideIcon;
};

function stateLabel(state: HubCardState) {
  if (state === "complete") return "Completed";
  if (state === "current") return "In progress";
  return "Not started";
}

export default function MyRegistrationDashboard({
  initialData,
}: {
  initialData: DashboardData;
}) {
  const [data, setData] = useState(initialData);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
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
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh registration.");
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
    } catch (credentialError) {
      setError(
        credentialError instanceof Error ? credentialError.message : "Credential unavailable.",
      );
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
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to remove registrant.");
      setBusy(false);
    }
  }

  function openDetails(targetId = "registration-details") {
    setDetailsOpen(true);
    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (data.state === "error") {
    return (
      <section className="mr-shell">
        <div className="mr-artwork-spacer" aria-hidden="true" />
        <article className="mr-alert-card">
          <p className="mr-section-label">Registration status</p>
          <h2>Unable to load registration</h2>
          <p className="mr-error" role="alert">
            {data.error || "Something went wrong."}
          </p>
          <button type="button" className="mr-cta mr-cta--primary" onClick={() => void refresh()}>
            Try again <ArrowRight aria-hidden="true" />
          </button>
        </article>
      </section>
    );
  }

  const primaryAction = data.nextActions[0] ?? {
    id: "view_registration",
    label: data.editable ? "Continue registration" : "View My Registration",
    href: data.editable ? "/register" : "#registration-details",
    priority: 1,
    reason: data.editable
      ? "Continue your saved Holy Convocation registration."
      : "Review the current registration details and status.",
  };
  const paymentAction = data.nextActions.find((action) =>
    ["complete_payment", "resume_payment", "wait_stripe"].includes(action.id),
  );
  const hasAction = (...ids: string[]) => data.nextActions.some((action) => ids.includes(action.id));
  const hasRegistration = data.state !== "none" && data.state !== "unauthorized";
  const progress = data.progress;

  const attendeeState: HubCardState = hasAction("complete_profile")
    ? "current"
    : hasRegistration
      ? "complete"
      : "upcoming";
  const registrationState: HubCardState = data.summary.productName
    ? "complete"
    : hasRegistration
      ? "current"
      : "upcoming";
  const housingState: HubCardState = data.housing.preference || data.housing.hotelName
    ? "complete"
    : "upcoming";
  const addOnsState: HubCardState = data.addOns.issuedTicketCount > 0 ? "complete" : "upcoming";
  const paymentState: HubCardState = data.state === "confirmed"
    ? "complete"
    : data.state === "submitted" || data.state === "payment_pending"
      ? "current"
      : "upcoming";
  const paymentHref =
    paymentAction?.href ?? (data.state === "confirmed" ? "#payments" : "/register");
  const travelHref = data.travel.href || TRAVEL_TRIP_PATH;

  const overviewCards: HubCard[] = [
    {
      id: "attendee",
      title: "Attendee Information",
      description:
        attendeeState === "complete"
          ? "Your registration profile is saved."
          : "Provide your personal and contact details.",
      action: data.editable ? "Edit information" : "View information",
      href: data.editable ? "/register" : "#registration-details",
      state: attendeeState,
      icon: UserRound,
    },
    {
      id: "registration",
      title: "Registration Type & Tickets",
      description: data.summary.productName || "Select your registration type and tickets.",
      action: primaryAction.label,
      href: primaryAction.href,
      state: registrationState,
      icon: Ticket,
    },
    {
      id: "housing",
      title: "Housing",
      description: data.housing.summary || "Reserve your room at official hotels.",
      action: "Open housing",
      href: data.housing.href || "/housing",
      state: housingState,
      icon: BedDouble,
    },
    {
      id: "extras",
      title: "Add-Ons & Extras",
      description:
        addOnsState === "complete"
          ? data.addOns.summary
          : "Explore ticketed experiences and Convocation extras.",
      action: "Browse tickets",
      href: data.addOns.href,
      state: addOnsState,
      icon: PlusCircle,
    },
    {
      id: "payment",
      title: "Review & Payment",
      description:
        paymentState === "complete"
          ? "Your registration payment is confirmed."
          : "Review your details and complete payment.",
      action: paymentAction?.label || (paymentState === "complete" ? "View payments" : "Review"),
      href: paymentHref,
      state: paymentState,
      icon: CreditCard,
    },
  ];

  const primaryActionIsInternal = primaryAction.href.startsWith("#");

  return (
    <section className="mr-shell">
      <div className="mr-artwork-spacer" aria-hidden="true" />

      {error ? (
        <p className="mr-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mr-live-message" role="status">
          {message}
        </p>
      ) : null}

      <section className="mr-hub" aria-labelledby="registration-overview-heading">
        <p className="mr-section-label">Registration overview</p>
        <h2 id="registration-overview-heading" className="mr-sr-only">
          Registration overview
        </h2>
        <div className="mr-overview-grid">
          {overviewCards.map((card) => {
            const Icon = card.icon;
            const dashboardTarget = card.href.startsWith("#");
            return (
              <article key={card.id} className="mr-overview-card" data-state={card.state}>
                <Icon className="mr-overview-card__icon" aria-hidden="true" />
                <h3>{card.title}</h3>
                <span className="mr-overview-card__rule" aria-hidden="true" />
                <p>{card.description}</p>
                {dashboardTarget ? (
                  <button
                    type="button"
                    className="mr-overview-card__action"
                    onClick={() => openDetails(card.href.slice(1))}
                  >
                    <span>{card.action}</span>
                    <ArrowRight aria-hidden="true" />
                  </button>
                ) : (
                  <Link href={card.href} className="mr-overview-card__action">
                    <span>{card.action}</span>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                )}
                <span className="mr-overview-card__status">
                  <span aria-hidden="true" />
                  {stateLabel(card.state)}
                </span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mr-progress-panel" aria-labelledby="registration-progress-heading">
        <div
          className="mr-progress-ring"
          style={{ "--mr-progress": `${progress}%` } as React.CSSProperties}
          role="progressbar"
          aria-label="Registration progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span>{progress}%</span>
        </div>
        <div className="mr-progress-panel__copy">
          <p className="mr-section-label">Registration status</p>
          <h2 id="registration-progress-heading">
            {hasRegistration ? `${label(data.summary.status)} registration` : "Ready to begin"}
          </h2>
          <p>
            {primaryAction.reason || "Continue where you left off in your Convocation journey."}
          </p>
        </div>
        <div className="mr-progress-panel__actions">
          {primaryActionIsInternal ? (
            <button
              type="button"
              className="mr-cta mr-cta--primary"
              onClick={() => openDetails(primaryAction.href.slice(1))}
            >
              {primaryAction.label} <ArrowRight aria-hidden="true" />
            </button>
          ) : (
            <Link href={primaryAction.href} className="mr-cta mr-cta--primary">
              {primaryAction.label} <ArrowRight aria-hidden="true" />
            </Link>
          )}
          <button
            type="button"
            className="mr-cta"
            aria-expanded={detailsOpen}
            aria-controls="registration-details"
            onClick={() => openDetails()}
          >
            View My Registration <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="mr-help" aria-labelledby="registration-help-heading">
        <p className="mr-section-label" id="registration-help-heading">
          Help &amp; info
        </p>
        <div className="mr-help__grid">
          <Link href="/register" className="mr-help-card">
            <FileText aria-hidden="true" />
            <span>
              <strong>Registration Guide</strong>
              <small>Step-by-step instructions</small>
            </span>
          </Link>
          <Link href="/contact-us" className="mr-help-card">
            <CircleHelp aria-hidden="true" />
            <span>
              <strong>Need Help?</strong>
              <small>Contact our support team</small>
            </span>
          </Link>
          {data.policy.accepted ? (
            <button type="button" className="mr-help-card" onClick={() => openDetails("policy")}>
              <ShieldCheck aria-hidden="true" />
              <span>
                <strong>Policies &amp; Terms</strong>
                <small>View your accepted policy</small>
              </span>
            </button>
          ) : (
            <Link href={data.policy.acceptHref} className="mr-help-card">
              <ShieldCheck aria-hidden="true" />
              <span>
                <strong>Policies &amp; Terms</strong>
                <small>Review required event policies</small>
              </span>
            </Link>
          )}
        </div>
      </section>

      {data.blockers.length ? (
        <section className="mr-blocker-panel" aria-label="Registration requirements">
          <p className="mr-section-label">Action needed</p>
          {data.blockers.map((blocker) => (
            <p key={blocker.id}>{blocker.label}</p>
          ))}
        </section>
      ) : null}

      <section className="mr-details" id="registration-details" aria-labelledby="registration-details-heading">
        <div className="mr-details__heading">
          <div>
            <p className="mr-section-label">My Convocation</p>
            <h2 id="registration-details-heading">Registration details</h2>
          </div>
          <button
            type="button"
            className="mr-details__toggle"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
          >
            {detailsOpen ? "Hide details" : "Open details"}
            <ArrowRight aria-hidden="true" />
          </button>
        </div>

        {detailsOpen ? (
          <div className="mr-details__content">
            {!hasRegistration ? (
              <article className="mr-detail-card mr-detail-card--empty">
                <UsersRound aria-hidden="true" />
                <div>
                  <h3>No registration yet</h3>
                  <p>
                    Start registration to select your product, add group members, and complete
                    payment.
                  </p>
                </div>
                <Link href="/register" className="mr-cta mr-cta--primary">
                  Begin Registration <ArrowRight aria-hidden="true" />
                </Link>
              </article>
            ) : null}

            <article className="mr-detail-card" id="registration">
              <div className="mr-detail-card__heading">
                <div>
                  <p className="mr-section-label">Registration summary</p>
                  <h3>Registration summary</h3>
                </div>
                {data.editable ? (
                  <Link href="/register" className="mr-detail-link">
                    Edit registration <ArrowRight aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
              <dl className="mr-stat-grid">
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
              </dl>
              <p className="mr-detail-note">
                Housing costs are not included in registration totals. Payment confirmation comes
                from Stripe webhook fulfillment, not the browser redirect.
              </p>
            </article>

            <article className="mr-detail-card" id="group">
              <div className="mr-detail-card__heading">
                <div>
                  <p className="mr-section-label">Attendees</p>
                  <h3>My registration information</h3>
                </div>
                {data.editable ? (
                  <Link href="/register" className="mr-detail-link">
                    Edit Registration Information <ArrowRight aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
              <dl className="mr-field-grid">
                {Object.entries(profileLabels).map(([key, title]) => (
                  <div key={key}>
                    <dt>{title}</dt>
                    <dd>{data.profile[key] || "—"}</dd>
                  </div>
                ))}
              </dl>
            </article>

            <article className="mr-detail-card">
              <div className="mr-detail-card__heading">
                <div>
                  <p className="mr-section-label">Group</p>
                  <h3>Group / junior registrants</h3>
                </div>
                {data.editable ? (
                  <Link href="/register" className="mr-detail-link">
                    Add group/junior registrant <ArrowRight aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
              <div className="mr-record-list">
                {data.members.map((member) => (
                  <article key={member.registrationId} className="mr-record">
                    <div>
                      <strong>{member.name}</strong>
                      <p>
                        {member.relationship}
                        {member.isJunior ? " · Junior" : ""}
                        {member.productName ? ` · ${member.productName}` : ""}
                      </p>
                      <p>
                        Status {label(member.status)} · Payment {label(member.paymentState)} · Credential{" "}
                        {label(member.credentialStatus)}
                        {member.dateOfBirth
                          ? ` · DOB ${member.dateOfBirth}`
                          : member.isJunior
                            ? " · DOB missing"
                            : ""}
                      </p>
                    </div>
                    <div className="mr-record__actions">
                      {member.canPresentCredential ? (
                        <button
                          type="button"
                          className="mr-inline-button mr-inline-button--primary"
                          disabled={busy}
                          onClick={() => void showCredential(member.registrationId, member.name)}
                        >
                          View Credential
                        </button>
                      ) : null}
                      {member.canEdit ? (
                        <Link href="/register" className="mr-inline-button">
                          Edit
                        </Link>
                      ) : null}
                      {member.canRemove ? (
                        <button
                          type="button"
                          className="mr-inline-button mr-inline-button--danger"
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

            <article className="mr-detail-card" id="payments">
              <div className="mr-detail-card__heading">
                <div>
                  <p className="mr-section-label">Payment</p>
                  <h3>Payments &amp; receipts</h3>
                </div>
                <CreditCard aria-hidden="true" />
              </div>
              <p className="mr-detail-note">
                Total {data.summary.totalAmountLabel} · Paid {data.summary.amountPaidLabel} · Remaining{" "}
                {data.summary.remainingBalanceLabel}
              </p>
              <div className="mr-record-list">
                {data.payments.length ? (
                  data.payments.map((payment) => (
                    <article key={payment.id} className="mr-record">
                      <div>
                        <strong>{payment.description}</strong>
                        <p>
                          {payment.createdAt
                            ? new Date(payment.createdAt).toLocaleString()
                            : "Date unavailable"}{" "}
                          · {payment.amountLabel} · {label(payment.status)}
                        </p>
                        {payment.stripeReference ? <p>Stripe reference {payment.stripeReference}</p> : null}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="mr-detail-note">No registration payment records yet.</p>
                )}
              </div>
            </article>

            <article className="mr-detail-card" id="credentials">
              <div className="mr-detail-card__heading">
                <div>
                  <p className="mr-section-label">Secure entry</p>
                  <h3>Credential / QR</h3>
                </div>
                <ShieldCheck aria-hidden="true" />
              </div>
              <div className="mr-record-list">
                {data.credentials.length ? (
                  data.credentials.map((item) => (
                    <article key={item.registrationId} className="mr-record">
                      <div>
                        <strong>{item.name}</strong>
                        <p>
                          Status {label(item.status)}
                          {item.badgeCodeMasked ? ` · Badge ${item.badgeCodeMasked}` : ""}
                        </p>
                        <p>
                          Issued {item.issuedAt ? new Date(item.issuedAt).toLocaleString() : "—"}
                          {item.rotatedAt ? ` · Rotated ${new Date(item.rotatedAt).toLocaleString()}` : ""}
                        </p>
                        <p>{item.message}</p>
                      </div>
                      {item.canPresent ? (
                        <button
                          type="button"
                          className="mr-inline-button mr-inline-button--primary"
                          disabled={busy}
                          onClick={() => void showCredential(item.registrationId, item.name)}
                        >
                          View Credential / QR
                        </button>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <p className="mr-detail-note">Credential available after confirmation.</p>
                )}
              </div>
            </article>

            <article className="mr-detail-card" id="policy">
              <div className="mr-detail-card__heading">
                <div>
                  <p className="mr-section-label">Policies</p>
                  <h3>Policy &amp; agreements</h3>
                </div>
                <FileText aria-hidden="true" />
              </div>
              {data.policy.accepted ? (
                <>
                  <p className="mr-detail-note">
                    Accepted version {data.policy.version || "—"}
                    {data.policy.signerName ? ` · Signer ${data.policy.signerName}` : ""}
                    {data.policy.acceptedAt
                      ? ` · ${new Date(data.policy.acceptedAt).toLocaleString()}`
                      : ""}
                  </p>
                  <button
                    type="button"
                    className="mr-inline-button"
                    onClick={() => setPolicyOpen(true)}
                  >
                    View accepted policy
                  </button>
                </>
              ) : (
                <>
                  <p className="mr-detail-note" role="status">
                    Required policy acceptance is incomplete
                    {data.policy.version ? ` (current version ${data.policy.version})` : ""}.
                  </p>
                  <Link href={data.policy.acceptHref} className="mr-inline-button mr-inline-button--primary">
                    Review/accept required policy
                  </Link>
                </>
              )}
            </article>

            <div className="mr-detail-duo">
              <article className="mr-detail-card" id="housing">
                <div className="mr-detail-card__heading">
                  <div>
                    <p className="mr-section-label">Stay</p>
                    <h3>Housing</h3>
                  </div>
                  <BedDouble aria-hidden="true" />
                </div>
                <p className="mr-detail-note">{data.housing.summary}</p>
                <p className="mr-detail-note">
                  {data.housing.hotelName || data.housing.blockName || label(data.housing.preference)}
                  {data.housing.arrival || data.housing.departure
                    ? ` · ${data.housing.arrival || "—"} to ${data.housing.departure || "—"}`
                    : ""}
                </p>
                <p className="mr-detail-note">Housing remains financially separate from registration.</p>
                <Link href={data.housing.href || "/housing"} className="mr-inline-button">
                  Open housing
                </Link>
              </article>

              <article className="mr-detail-card" id="travel">
                <div className="mr-detail-card__heading">
                  <div>
                    <p className="mr-section-label">Travel</p>
                    <h3>My Trip</h3>
                  </div>
                  <Ticket aria-hidden="true" />
                </div>
                <p className="mr-detail-note">
                  {data.travel.hasActivity
                    ? "You have travel activity on My Trip."
                    : "Plan hotels, flights, and cars in COGIC Travel when you are ready."}
                </p>
                <Link href={travelHref} className="mr-inline-button">
                  View My Trip
                </Link>
              </article>
            </div>

            {(data.state === "canceled" || data.state === "refunded") && (
              <article className="mr-detail-card mr-detail-card--warning">
                <h3>{data.state === "canceled" ? "Registration canceled" : "Registration refunded"}</h3>
                <p>
                  This registration is not active. Credentials are not usable for entry from this
                  registration. You may start a new registration if eligible.
                </p>
                <div className="mr-record__actions">
                  <Link href="/register" className="mr-inline-button mr-inline-button--primary">
                    Start a new registration
                  </Link>
                  <Link href="/contact-us" className="mr-inline-button">
                    Contact support
                  </Link>
                </div>
              </article>
            )}

            <div className="mr-dashboard-actions">
              <button type="button" className="mr-inline-button" disabled={busy} onClick={() => void refresh()}>
                <RefreshCw aria-hidden="true" />
                {busy ? "Refreshing..." : "Refresh status"}
              </button>
              <Link href="/my-convocation" className="mr-inline-button">
                Back to My Convocation
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      {policyOpen && data.policy.snapshot ? (
        <div className="mr-modal" role="dialog" aria-modal="true" aria-label="Accepted policy">
          <div className="mr-modal__card">
            <button type="button" className="mr-inline-button" onClick={() => setPolicyOpen(false)}>
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
          <div className="mr-modal__card mr-modal__card--credential">
            <button type="button" className="mr-inline-button" onClick={() => setCredential(null)}>
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
