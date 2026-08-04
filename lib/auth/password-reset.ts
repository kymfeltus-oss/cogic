import type { NextRequest } from "next/server";
import { buildAuthCallbackUrl } from "@/lib/auth/server";
import {
  DEFAULT_ATTENDEE_NEXT,
  buildResetPasswordUrl,
  resolveAttendeeDestination,
  sanitizeNextPath,
} from "@/lib/auth/routing";

/** Supabase password-recovery email redirect — lands on /auth/callback then /reset-password. */
export function buildPasswordRecoveryRedirectUrl(
  request?: NextRequest | Request,
  nextPath?: string | null,
): string {
  const attendeeNext = resolveAttendeeDestination(
    sanitizeNextPath(nextPath ?? null, DEFAULT_ATTENDEE_NEXT),
  );
  return buildAuthCallbackUrl(buildResetPasswordUrl(attendeeNext), request);
}
