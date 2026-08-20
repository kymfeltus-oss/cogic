"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EMAIL_GATE_ACTION_SLOTS, type EmailGateActionSlot } from "@/lib/email-gate/email-gate-slots";
import {
  buildTeamGateUrl,
  resolveAttendeeDestination,
  sanitizeNextPath,
  DEFAULT_ATTENDEE_NEXT,
} from "@/lib/auth/routing";

export default function EmailGateOverlay() {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const attendeeNext = resolveAttendeeDestination(
    sanitizeNextPath(rawNext, DEFAULT_ATTENDEE_NEXT),
  );

  const hrefById: Record<EmailGateActionSlot["id"], string> = {
    attendee: attendeeNext,
    team: buildTeamGateUrl(rawNext),
  };

  return (
    <div className="email-gate-page__actions" aria-label="Entry path selection">
      {EMAIL_GATE_ACTION_SLOTS.map((action) => (
        <Link
          key={action.id}
          href={hrefById[action.id]}
          aria-label={action.label}
          className="email-gate-page__action touch-target rounded-[999px] bg-transparent transition hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
          style={{
            left: action.left,
            top: action.top,
            width: action.width,
            height: action.height,
          }}
        />
      ))}
    </div>
  );
}
