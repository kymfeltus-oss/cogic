import type { Metadata } from "next";
import { redirect } from "next/navigation";

import RegistrationSlice2Experience from "@/components/registration/RegistrationSlice2Experience";
import BeforeYouBegin from "@/components/registration/BeforeYouBegin";
import { parseAccessContext } from "@/lib/access";
import { buildAttendeeGateUrl, CREATE_ACCOUNT_PATH } from "@/lib/auth/routing";
import { getUserFromSession } from "@/lib/auth/session";
import { resolveRegisterWizardIntent } from "@/lib/registration/registration-requirements";
import { loadOrMigrateRegistrationExperience } from "@/lib/registration/slice2-repository";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Register | Holy Convocation",
  description: "Register for the Holy Convocation.",
};

type RegisterPageProps = {
  searchParams: Promise<{ step?: string }>;
};

/**
 * `/register?step=` is an intent signal, not a permission grant.
 * Illegal destinations are clamped server-side to evaluator boundaries.
 */
export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const user = await getUserFromSession();
  if (!user) {
    redirect(buildAttendeeGateUrl("/register"));
  }
  if (parseAccessContext(user).isGuest) {
    redirect(`${CREATE_ACCOUNT_PATH}?next=${encodeURIComponent("/register")}`);
  }

  const initial = await loadOrMigrateRegistrationExperience(user.id);
  if (initial.group?.status === "confirmed") {
    redirect("/register/payment/complete");
  }
  if (initial.group && initial.group.status !== "draft") {
    redirect("/register/review");
  }

  const beforeAcknowledged = initial.group?.wizard_metadata?.before_you_begin_acknowledged === true;
  if (!beforeAcknowledged) {
    return (
      <main id="main-content" className="registration-page">
        <BeforeYouBegin groupVersion={initial.group?.row_version ?? null} />
      </main>
    );
  }

  const requestedStep = (await searchParams).step?.trim().toLowerCase() ?? "";
  const resolved = resolveRegisterWizardIntent({
    requestedStep,
    requirements: initial.requirements,
  });

  // Canonicalize illegal or empty step intents so the URL never outranks the evaluator.
  if (!requestedStep || resolved.clampedFromIllegalIntent) {
    redirect(`/register?step=${resolved.activeStepId}`);
  }

  return (
    <main id="main-content" className="registration-page">
      <RegistrationSlice2Experience
        initial={initial}
        initialStep={resolved.activeStepNumber}
        activeStepId={resolved.activeStepId}
        resumeStep={initial.requirements.resumeStep}
      />
    </main>
  );
}
