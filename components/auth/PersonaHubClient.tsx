"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import EmailGateShell from "@/components/auth/EmailGateShell";
import {
  buildTeamGateUrl,
  resolveAttendeeDestination,
  sanitizeNextPath,
  DEFAULT_ATTENDEE_NEXT,
} from "@/lib/auth/routing";

export default function PersonaHubClient() {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const attendeeNext = resolveAttendeeDestination(
    sanitizeNextPath(rawNext, DEFAULT_ATTENDEE_NEXT),
  );

  const teamHref = buildTeamGateUrl(rawNext);

  return (
    <EmailGateShell>
      <div className="flex flex-col gap-3">
        <Link
          href={attendeeNext}
          className="flex min-h-11 items-center justify-center rounded-lg border border-brand-border px-4 py-2 text-sm text-white"
        >
          Attendee — continue to dashboard
        </Link>
        <Link
          href={teamHref}
          className="flex min-h-11 items-center justify-center rounded-lg border border-brand-border px-4 py-2 text-sm text-brand-muted"
        >
          Team login
        </Link>
      </div>
    </EmailGateShell>
  );
}
