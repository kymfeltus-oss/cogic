import type { Metadata } from "next";
import { redirect } from "next/navigation";
import RegistrationWizard from "@/components/registration/RegistrationWizard";
import { parseAccessContext } from "@/lib/access";
import {
  ATTENDEE_GATE_PATH,
  CREATE_ACCOUNT_PATH,
  buildAttendeeGateUrl,
} from "@/lib/auth/routing";
import { getUserFromSession } from "@/lib/auth/session";
import { createOrResumeRegistrationDraft } from "@/lib/registration/actions";
import { getRegistrationFeeLabelOrNull } from "@/lib/registration/fee-display";
import { resolveRegistrationViewMode } from "@/lib/registration/workflow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Register | Holy Convocation",
  description: "Register for the Holy Convocation.",
};

type RegisterPageProps = {
  searchParams: Promise<{ step?: string }>;
};

function parseStep(raw: string | undefined): 1 | 2 | 3 {
  const value = Number(raw);
  if (value === 2 || value === 3) return value;
  return 1;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const user = await getUserFromSession();

  if (!user) {
    redirect(buildAttendeeGateUrl("/register"));
  }

  const access = parseAccessContext(user);
  if (access.isGuest) {
    redirect(`${CREATE_ACCOUNT_PATH}?next=${encodeURIComponent("/register")}`);
  }

  const result = await createOrResumeRegistrationDraft();
  if (result.ok === false) {
    if (result.code === "auth_required") {
      redirect(buildAttendeeGateUrl("/register"));
    }
    if (result.code === "guest_not_allowed") {
      redirect(`${CREATE_ACCOUNT_PATH}?next=${encodeURIComponent("/register")}`);
    }

    return (
      <main id="main-content" className="registration-page">
        <section className="registration-shell" aria-labelledby="registration-error-heading">
          <h1 id="registration-error-heading" className="registration-title">
            Registration unavailable
          </h1>
          <p className="registration-lead">{result.message}</p>
          <a href={ATTENDEE_GATE_PATH} className="registration-btn registration-btn-primary">
            Sign in again
          </a>
        </section>
      </main>
    );
  }

  const viewMode = resolveRegistrationViewMode(result.registration);
  const step = parseStep(params.step);
  const feeLabel = getRegistrationFeeLabelOrNull();

  return (
    <main id="main-content" className="registration-page">
      <RegistrationWizard
        initialRegistration={result.registration}
        initialStep={viewMode === "wizard" ? step : 1}
        feeLabel={feeLabel}
        mode={
          viewMode === "wizard"
            ? "wizard"
            : viewMode === "submitted"
              ? "submitted"
              : viewMode === "payment_pending"
                ? "payment_pending"
                : viewMode === "confirmed"
                  ? "confirmed"
                  : "wizard"
        }
      />
    </main>
  );
}
