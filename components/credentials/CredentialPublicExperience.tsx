import {
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
} from "lucide-react";

import {
  CREDENTIAL_CONFIRMED_HEADING,
  CREDENTIAL_CONFIRMED_LEAD,
  CREDENTIAL_SUPPORT_INSTRUCTIONS,
  CREDENTIAL_UNAVAILABLE_MESSAGE,
  programDisplayLabel,
} from "@/lib/credentials/public-copy";
import type { ResolvedPublicCredential } from "@/lib/credentials/public-outcome";

type CredentialPublicExperienceProps = {
  credential: ResolvedPublicCredential;
};

export default function CredentialPublicExperience({
  credential,
}: CredentialPublicExperienceProps) {
  const programLabel = programDisplayLabel(credential.programKey);
  const statusLabel =
    credential.status === "active" ? "Active credential" : "Issued credential";

  return (
    <article className="credential-public-card">
      <header className="credential-public-header">
        <div className="credential-public-icon credential-public-icon--success" aria-hidden="true">
          <CheckCircle2 className="h-7 w-7" strokeWidth={2.2} />
        </div>
        <p className="credential-public-kicker">COGIC Stream</p>
        <h1 className="credential-public-title">{CREDENTIAL_CONFIRMED_HEADING}</h1>
        <p className="credential-public-lead">{CREDENTIAL_CONFIRMED_LEAD}</p>
      </header>

      <dl className="credential-public-summary" aria-label="Credential details">
        <div>
          <dt>Status</dt>
          <dd>{statusLabel}</dd>
        </div>
        {credential.firstName ? (
          <div>
            <dt>First name</dt>
            <dd>{credential.firstName}</dd>
          </div>
        ) : null}
        {credential.churchName ? (
          <div>
            <dt>Church</dt>
            <dd>{credential.churchName}</dd>
          </div>
        ) : null}
        {credential.jurisdiction ? (
          <div>
            <dt>Jurisdiction</dt>
            <dd>{credential.jurisdiction}</dd>
          </div>
        ) : null}
        {programLabel ? (
          <div>
            <dt>Program</dt>
            <dd>{programLabel}</dd>
          </div>
        ) : null}
        {credential.badgeCode ? (
          <div>
            <dt>Badge code</dt>
            <dd>
              <code className="credential-public-code">{credential.badgeCode}</code>
            </dd>
          </div>
        ) : null}
      </dl>

      <section className="credential-public-support" aria-labelledby="credential-support-heading">
        <div className="credential-public-icon credential-public-icon--info" aria-hidden="true">
          <HelpCircle className="h-6 w-6" strokeWidth={2.2} />
        </div>
        <h2 id="credential-support-heading" className="credential-public-support-title">
          Need help?
        </h2>
        <p className="credential-public-support-copy">{CREDENTIAL_SUPPORT_INSTRUCTIONS}</p>
        <a href="/contact-us" className="credential-public-action">
          Contact registration support
        </a>
      </section>
    </article>
  );
}

export function CredentialPublicUnavailable() {
  return (
    <article className="credential-public-card">
      <header className="credential-public-header">
        <div className="credential-public-icon credential-public-icon--warn" aria-hidden="true">
          <ShieldAlert className="h-7 w-7" strokeWidth={2.2} />
        </div>
        <p className="credential-public-kicker">COGIC Stream</p>
        <h1 className="credential-public-title">Credential unavailable</h1>
        <p className="credential-public-lead">{CREDENTIAL_UNAVAILABLE_MESSAGE}</p>
      </header>

      <section className="credential-public-support" aria-labelledby="credential-unavailable-support-heading">
        <h2 id="credential-unavailable-support-heading" className="credential-public-support-title">
          Registration support
        </h2>
        <p className="credential-public-support-copy">{CREDENTIAL_SUPPORT_INSTRUCTIONS}</p>
        <a href="/contact-us" className="credential-public-action">
          Contact registration support
        </a>
      </section>
    </article>
  );
}
