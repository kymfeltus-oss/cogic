import type { Metadata } from "next";
import { redirect } from "next/navigation";

import RegistrationSlice2Experience from "@/components/registration/RegistrationSlice2Experience";
import { parseAccessContext } from "@/lib/access";
import { buildAttendeeGateUrl, CREATE_ACCOUNT_PATH } from "@/lib/auth/routing";
import { getUserFromSession } from "@/lib/auth/session";
import { loadOrMigrateRegistrationExperience } from "@/lib/registration/slice2-repository";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Register | Holy Convocation",
  description: "Register for the Holy Convocation.",
};

export default async function RegisterPage() {
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

  return (
    <main id="main-content" className="registration-page">
      <RegistrationSlice2Experience initial={initial} />
    </main>
  );
}
