import type { Metadata } from "next";
import { Suspense } from "react";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
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

async function DashboardPageBody() {
  const data = await loadAttendeeDashboard();
  return <DashboardShell data={data} dashboardPath="/my-sanctuary" />;
}

export default function MySanctuaryPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardPageBody />
    </Suspense>
  );
}
