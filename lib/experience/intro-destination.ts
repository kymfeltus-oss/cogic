import {
  buildAttendeeGateUrl,
  DEFAULT_ATTENDEE_NEXT,
} from "@/lib/auth/routing";

export type IntroEnterReason =
  | "anonymous"
  | "guest"
  | "unregistered"
  | "registered";

export type IntroEnterDestination = {
  destination: string;
  reason: IntroEnterReason;
};

/**
 * Resolve where Enter should go based on session + registration.
 * Pure — server route supplies auth/registration facts.
 *
 * Anonymous attendees go straight to `/login` (hard navigation from intro)
 * to avoid soft RSC hops through `/email-gate` → `/login`.
 */
export function resolveIntroEnterDestination(input: {
  userId: string | null;
  isGuest: boolean;
  hasActiveRegistration: boolean;
}): IntroEnterDestination {
  if (!input.userId) {
    return {
      destination: buildAttendeeGateUrl(DEFAULT_ATTENDEE_NEXT),
      reason: "anonymous",
    };
  }

  if (input.isGuest) {
    return {
      destination: DEFAULT_ATTENDEE_NEXT,
      reason: "guest",
    };
  }

  if (!input.hasActiveRegistration) {
    return {
      destination: "/register",
      reason: "unregistered",
    };
  }

  return {
    destination: DEFAULT_ATTENDEE_NEXT,
    reason: "registered",
  };
}

/** Fallback when the destination API is unavailable. */
export function introEnterAnonymousFallback(): string {
  return buildAttendeeGateUrl(DEFAULT_ATTENDEE_NEXT);
}
