import { DEFAULT_ATTENDEE_NEXT } from "@/lib/auth/routing";

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
 * Enter always goes to the attendee dashboard.
 * Attendee login is not part of the public entry path.
 */
export function resolveIntroEnterDestination(input: {
  userId: string | null;
  isGuest: boolean;
  hasActiveRegistration: boolean;
}): IntroEnterDestination {
  return {
    destination: DEFAULT_ATTENDEE_NEXT,
    reason: input.userId
      ? input.isGuest
        ? "guest"
        : input.hasActiveRegistration
          ? "registered"
          : "unregistered"
      : "anonymous",
  };
}

/** Fallback when the destination API is unavailable. */
export function introEnterAnonymousFallback(): string {
  return DEFAULT_ATTENDEE_NEXT;
}
