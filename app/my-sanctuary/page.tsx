import type { Metadata } from "next";
import { Suspense } from "react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { COGIC_LIVE_PUBLIC_NAME } from "@/lib/brand/public-display";
import { loadAttendeeDashboard } from "@/lib/dashboard/load-attendee-dashboard";
import "../my-convocation/dashboard.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: `My Sanctuary | ${COGIC_LIVE_PUBLIC_NAME}`,
  description: "Your personalized COGIC LIVE Holy Convocation home.",
};

export default async function MySanctuaryPage() {
  const data = await loadAttendeeDashboard();
  return (
    <Suspense fallback={null}>
      <DashboardShell data={data} dashboardPath="/my-sanctuary" />
    </Suspense>
  );
}
