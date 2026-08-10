import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserFromSession } from "@/lib/auth/session";
import { COGIC_LIVE_PUBLIC_NAME } from "@/lib/brand/public-display";
import { loadMyRegistrationDashboard } from "@/lib/registration/load-my-registration";
import MyRegistrationDashboard from "@/components/registration/MyRegistrationDashboard";
import "./registration-dashboard.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: `My Registration | ${COGIC_LIVE_PUBLIC_NAME}`,
  description: "View and manage your Holy Convocation registration, payment, group, policies, and credential.",
};

export default async function MyRegistrationPage() {
  const user = await getUserFromSession();
  if (!user?.id) {
    redirect("/login?next=%2Fmy-convocation%2Fregistration");
  }

  const data = await loadMyRegistrationDashboard(user.id);

  return (
    <main id="main-content" className="mr-page">
      <header className="mr-page__header">
        <Link href="/my-convocation" className="mr-back">
          ← My Convocation
        </Link>
        <h1>My Registration</h1>
        <p>Your Holy Convocation registration status, group, payments, policies, and credential.</p>
      </header>
      <MyRegistrationDashboard initialData={data} />
    </main>
  );
}
