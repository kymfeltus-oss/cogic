import type { Metadata } from "next";
import { redirect } from "next/navigation";

import RegistrationGroupStatus from "@/components/registration/RegistrationGroupStatus";
import { parseAccessContext } from "@/lib/access";
import { buildAttendeeGateUrl, CREATE_ACCOUNT_PATH } from "@/lib/auth/routing";
import { getUserFromSession } from "@/lib/auth/session";
import { loadOrMigrateRegistrationExperience } from "@/lib/registration/slice2-repository";

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
  if (parseAccessContext(user).isGuest) {
    redirect(`${CREATE_ACCOUNT_PATH}?next=${encodeURIComponent("/register/payment/complete")}`);
  }

  const experience = await loadOrMigrateRegistrationExperience(user.id);
  if (!experience.group || experience.group.status === "draft") {
    redirect("/register");
  }
  if (experience.group.status === "submitted") {
    redirect("/register/review");
  }

  return (
    <main id="main-content" className="registration-page">
      <RegistrationGroupStatus experience={experience} paymentComplete />
    </main>
  );
}
