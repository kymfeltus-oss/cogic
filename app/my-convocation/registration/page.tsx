import type { Metadata } from "next";
import Link from "next/link";
import MyRegistrationDashboard from "@/components/registration/MyRegistrationDashboard";
import { getUserFromSession } from "@/lib/auth/session";
import { COGIC_LIVE_PUBLIC_NAME } from "@/lib/brand/public-display";
import { loadMyRegistrationDashboard } from "@/lib/registration/load-my-registration";
import "./registration-dashboard.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: `My Registration | ${COGIC_LIVE_PUBLIC_NAME}`,
  description: "View and manage your Holy Convocation registration, payment, group, policies, and credential.",
};

export default async function MyRegistrationPage() {
  const user = await getUserFromSession();
  const data = await loadMyRegistrationDashboard(user?.id);

  return (
    <main id="main-content" className="mr-page">
      <header className="mr-artwork-controls">
        <Link
          href="/my-convocation"
          className="mr-artwork-control mr-artwork-control--back"
          aria-label="Back to My Convocation"
        />
        <Link
          href="/my-convocation"
          className="mr-artwork-control mr-artwork-control--home"
          aria-label="COGIC LIVE home"
        />
      </header>
      <h1 className="mr-sr-only">Registration Hub</h1>
      <MyRegistrationDashboard initialData={data} />
    </main>
  );
}
