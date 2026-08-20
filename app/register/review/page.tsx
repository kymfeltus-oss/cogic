import type { Metadata } from "next";
import { redirect } from "next/navigation";

import RegistrationGroupStatus from "@/components/registration/RegistrationGroupStatus";
import { parseAccessContext } from "@/lib/access";
import { DEFAULT_ATTENDEE_NEXT, CREATE_ACCOUNT_PATH } from "@/lib/auth/routing";
import { getUserFromSession } from "@/lib/auth/session";
import { loadOrMigrateRegistrationExperience } from "@/lib/registration/slice2-repository";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Review registration | Holy Convocation",
  description: "Review and pay for your Holy Convocation registration.",
};

type RegisterReviewPageProps = {
  searchParams: Promise<{ checkout?: string }>;
};

export default async function RegisterReviewPage({ searchParams }: RegisterReviewPageProps) {
  const params = await searchParams;
  const user = await getUserFromSession();
  if (!user) {
    redirect(DEFAULT_ATTENDEE_NEXT);
  }
  if (parseAccessContext(user).isGuest) {
    redirect(`${CREATE_ACCOUNT_PATH}?next=${encodeURIComponent("/register/review")}`);
  }

  const experience = await loadOrMigrateRegistrationExperience(user.id);
  if (!experience.group || experience.group.status === "draft") {
    redirect("/register");
  }
  if (experience.group.status === "confirmed") {
    redirect("/register/payment/complete");
  }

  return (
    <main id="main-content" className="registration-page">
      <RegistrationGroupStatus experience={experience} checkoutCanceled={params.checkout === "canceled"} />
    </main>
  );
}
