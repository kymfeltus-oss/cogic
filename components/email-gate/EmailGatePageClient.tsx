"use client";

import { useSearchParams } from "next/navigation";
import EmailGatePersonaPlate from "@/components/email-gate/EmailGatePersonaPlate";
import {
  buildAttendeeGateUrl,
  buildTeamGateUrl,
  resolveAttendeeDestination,
  sanitizeNextPath,
  setAuthNextCookie,
  DEFAULT_ATTENDEE_NEXT,
} from "@/lib/auth/routing";

export default function EmailGatePageClient() {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const attendeeNext = resolveAttendeeDestination(
    sanitizeNextPath(rawNext, DEFAULT_ATTENDEE_NEXT),
  );

  return (
    <EmailGatePersonaPlate
      attendeeHref={buildAttendeeGateUrl(attendeeNext)}
      teamHref={buildTeamGateUrl(rawNext)}
      onAttendeeSelect={() => setAuthNextCookie(attendeeNext)}
    />
  );
}
