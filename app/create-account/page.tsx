import type { Metadata } from "next";
import { cookies } from "next/headers";
import CreateAccountClient from "@/components/auth/CreateAccountClient";
import {
  AUTH_NEXT_COOKIE,
  DEFAULT_ATTENDEE_NEXT,
  resolveAttendeeDestination,
} from "@/lib/auth/routing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create Account | COGIC LIVE",
  description: "Create your COGIC LIVE account.",
};

type CreateAccountPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function CreateAccountPage({ searchParams }: CreateAccountPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const nextFromCookie = cookieStore.get(AUTH_NEXT_COOKIE)?.value;
  const nextPath = resolveAttendeeDestination(
    params.next ?? nextFromCookie ?? DEFAULT_ATTENDEE_NEXT,
  );

  return (
    <main
      id="main-content"
      className="cogic-auth-shell flex min-h-0 w-full flex-1 flex-col overflow-hidden"
      aria-label="Create account"
    >
      <CreateAccountClient nextPath={nextPath} />
    </main>
  );
}
