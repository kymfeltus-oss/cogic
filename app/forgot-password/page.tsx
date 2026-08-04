import type { Metadata } from "next";
import { cookies } from "next/headers";
import ForgotPasswordClient from "@/components/auth/ForgotPasswordClient";
import {
  AUTH_NEXT_COOKIE,
  buildAttendeeGateUrl,
  DEFAULT_ATTENDEE_NEXT,
  resolveAttendeeDestination,
} from "@/lib/auth/routing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset Password | 300 Awakening",
  description: "Request a password reset link for your 300 Awakening account.",
};

type ForgotPasswordPageProps = {
  searchParams: Promise<{ next?: string; email?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const nextFromCookie = cookieStore.get(AUTH_NEXT_COOKIE)?.value;
  const nextPath = resolveAttendeeDestination(
    params.next ?? nextFromCookie ?? DEFAULT_ATTENDEE_NEXT,
  );

  return (
    <main
      id="main-content"
      className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-brand-black"
      aria-label="Forgot password"
    >
      <ForgotPasswordClient
        nextPath={nextPath}
        loginHref={buildAttendeeGateUrl(nextPath)}
        initialEmail={params.email ?? ""}
      />
    </main>
  );
}
