import type { Metadata } from "next";
import { redirect } from "next/navigation";
import RegistrationPaymentCompleteClient from "@/components/registration/RegistrationPaymentCompleteClient";
import { parseAccessContext } from "@/lib/access";
import {
  ATTENDEE_GATE_PATH,
  CREATE_ACCOUNT_PATH,
  buildAttendeeGateUrl,
} from "@/lib/auth/routing";
import { getUserFromSession } from "@/lib/auth/session";
import { loadRegistrationForCurrentUser } from "@/lib/registration/actions";
import { getRegistrationFeeLabelOrNull } from "@/lib/registration/fee-display";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment confirmation | Holy Convocation",
  description: "Confirming your Holy Convocation registration payment.",
};

export default async function RegisterPaymentCompletePage() {
  const user = await getUserFromSession();
  if (!user) {
    redirect(buildAttendeeGateUrl("/register/payment/complete"));
  }

  const access = parseAccessContext(user);
  if (access.isGuest) {
    redirect(`${CREATE_ACCOUNT_PATH}?next=${encodeURIComponent("/register")}`);
  }

  const result = await loadRegistrationForCurrentUser();
  if (result.ok === false) {
    if (result.code === "auth_required") {
      redirect(buildAttendeeGateUrl("/register/payment/complete"));
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

  return (
    <main id="main-content" className="registration-page">
      <RegistrationPaymentCompleteClient
        registration={result.registration}
        feeLabel={getRegistrationFeeLabelOrNull()}
      />
    </main>
  );
}
