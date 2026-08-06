import { redirect } from "next/navigation";

import { ATTENDEE_DASHBOARD_PATH } from "@/lib/navigation/back-to-dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AttendeeDashboardPageProps = {
  searchParams: Promise<{ view?: string }>;
};

/**
 * Legacy Awakening home — permanently retired as the attendee hub.
 * Preserve profile/settings deep links on the COGIC My Convocation hub.
 */
export default async function AttendeeDashboardPage({
  searchParams,
}: AttendeeDashboardPageProps) {
  const params = await searchParams;
  const view = params.view?.trim();

  if (view === "profile" || view === "settings") {
    redirect(`${ATTENDEE_DASHBOARD_PATH}?view=${encodeURIComponent(view)}`);
  }

  redirect(ATTENDEE_DASHBOARD_PATH);
}
