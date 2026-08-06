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
import { loadRegistrationForCurrentUser } from "@/lib/registration/actions";
import { getRegistrationFeeLabelOrNull } from "@/lib/registration/fee-display";
import { resolveRegistrationViewMode } from "@/lib/registration/workflow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review registration | Holy Convocation",
  description: "Review and submit your Holy Convocation registration.",
};

type RegisterReviewPageProps = {
  searchParams: Promise<{ checkout?: string }>;
};

export default async function RegisterReviewPage({
  searchParams,
}: RegisterReviewPageProps) {
  const params = await searchParams;
  const user = await getUserFromSession();
  if (!user) {
    redirect(buildAttendeeGateUrl("/register/review"));
  }

  const access = parseAccessContext(user);
  if (access.isGuest) {
    redirect(`${CREATE_ACCOUNT_PATH}?next=${encodeURIComponent("/register")}`);
  }

  const result = await loadRegistrationForCurrentUser();
  if (result.ok === false) {
    if (result.code === "auth_required") {
      redirect(buildAttendeeGateUrl("/register/review"));
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

  if (viewMode === "wizard") {
    const incomplete =
      !result.registration.firstName ||
      !result.registration.lastName ||
      !result.registration.email ||
      !result.registration.mobilePhone ||
      !result.registration.churchName ||
      !result.registration.pastorName ||
      !result.registration.jurisdiction ||
      !result.registration.streetAddress ||
      !result.registration.city ||
      !result.registration.state ||
      !result.registration.postalCode;

    if (incomplete) {
      redirect("/register?step=1");
    }
  }

  const feeLabel = getRegistrationFeeLabelOrNull();
  const checkoutCanceled = params.checkout === "canceled";

  return (
    <main id="main-content" className="registration-page">
      <RegistrationWizard
        initialRegistration={result.registration}
        initialStep={4}
        feeLabel={feeLabel}
        checkoutCanceled={checkoutCanceled}
        mode={
          viewMode === "wizard"
            ? "review"
            : viewMode === "submitted"
              ? "submitted"
              : viewMode === "payment_pending"
                ? "payment_pending"
                : viewMode === "confirmed"
                  ? "confirmed"
                  : "review"
        }
      />
    </main>
  );
}
