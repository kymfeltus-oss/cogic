import type { Metadata } from "next";
import AccountOtpVerificationClient from "@/components/auth/AccountOtpVerificationClient";
import { DEFAULT_ATTENDEE_NEXT, resolveAttendeeDestination } from "@/lib/auth/routing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify Account | COGIC LIVE" };

export default async function VerifyAccountPage({ searchParams }: { searchParams: Promise<{ email?: string; next?: string }> }) {
  const params = await searchParams;
  return <AccountOtpVerificationClient initialEmail={params.email?.trim().toLowerCase() ?? ""} nextPath={resolveAttendeeDestination(params.next ?? DEFAULT_ATTENDEE_NEXT)} />;
}
