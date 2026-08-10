import type { Metadata } from "next";
import { Suspense } from "react";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { COGIC_LIVE_PUBLIC_NAME } from "@/lib/brand/public-display";
import { loadAttendeeDashboard } from "@/lib/dashboard/load-attendee-dashboard";
import "./dashboard.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: `My Convocation | ${COGIC_LIVE_PUBLIC_NAME}`,
  description: "Your registration, schedule, live broadcast, and attendee account shortcuts.",
};

async function DashboardPageBody() {
  const data = await loadAttendeeDashboard();
  return <DashboardShell data={data} />;
}

export default function MyConvocationPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardPageBody />
    </Suspense>
  );
}
