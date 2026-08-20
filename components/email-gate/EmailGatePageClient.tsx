"use client";

import { useSearchParams } from "next/navigation";
import EmailGatePersonaPlate from "@/components/email-gate/EmailGatePersonaPlate";
import {
  buildTeamGateUrl,
  resolveAttendeeDestination,
  sanitizeNextPath,
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
      attendeeHref={attendeeNext}
      teamHref={buildTeamGateUrl(rawNext)}
    />
  );
}
