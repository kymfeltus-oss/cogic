import type { Metadata } from "next";
import { cookies } from "next/headers";
import ResetPasswordClient from "@/components/auth/ResetPasswordClient";
import {
  AUTH_NEXT_COOKIE,
  buildAttendeeGateUrl,
  buildForgotPasswordUrl,
  DEFAULT_ATTENDEE_NEXT,
  resolveAttendeeDestination,
} from "@/lib/auth/routing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Choose New Password | COGIC LIVE",
  description: "Set a new password for your COGIC LIVE account.",
};

type ResetPasswordPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
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
      aria-label="Reset password"
    >
      <ResetPasswordClient
        nextPath={nextPath}
        loginHref={buildForgotPasswordUrl(nextPath)}
      />
    </main>
  );
}
