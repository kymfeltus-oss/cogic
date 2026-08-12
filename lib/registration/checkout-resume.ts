/**
 * Attendee-facing checkout resume strategy.
 * Mode is derived only from server-loaded group/payment state (+ payment-complete page flag).
 * Stripe Session open/expired is decided server-side in createRegistrationCheckoutSession.
 */

export type RegistrationCheckoutResumeMode =
  | "not_applicable"
  | "awaiting_first_checkout"
  | "pending_session"
  | "stale_replace"
  | "webhook_processing";

export type RegistrationCheckoutResumeInput = {
  groupStatus: string | null | undefined;
  paymentStatus: string | null | undefined;
  /** True on /register/payment/complete after Stripe redirect — not payment authority. */
  paymentComplete?: boolean;
};

export function deriveRegistrationCheckoutResumeMode(
  input: RegistrationCheckoutResumeInput,
): RegistrationCheckoutResumeMode {
  const groupStatus = input.groupStatus ?? null;
  const paymentStatus = input.paymentStatus ?? null;

  if (groupStatus === "submitted") {
    return "awaiting_first_checkout";
  }

  if (groupStatus !== "payment_pending") {
    return "not_applicable";
  }

  // Redirect or paid row means capture may already have happened — wait for webhook/ledger sync.
  if (
    input.paymentComplete === true ||
    paymentStatus === "paid" ||
    paymentStatus === "processing"
  ) {
    return "webhook_processing";
  }

  if (paymentStatus === "pending") {
    return "pending_session";
  }

  // failed / canceled / missing pending row while group is still payment_pending
  return "stale_replace";
}

export function registrationCheckoutResumeCopy(
  mode: RegistrationCheckoutResumeMode,
): string | null {
  switch (mode) {
    case "awaiting_first_checkout":
      return "Secure checkout creates a Stripe Session from the server-verified registration total.";
    case "pending_session":
      return "An active Stripe checkout session is already open for your group. Resume payment reconnects you to that existing session when it is still available, without creating a duplicate charge intent.";
    case "stale_replace":
      return "Your prior payment window is no longer usable. Resume payment invalidates the stale pending intent server-side and creates a replacement Stripe Session from the verified registration total.";
    case "webhook_processing":
      return "We detected a Stripe payment return and are syncing your registration ledger. Please wait — do not start another checkout while confirmation is in progress.";
    default:
      return null;
  }
}

export function canShowRegistrationCheckoutResume(
  mode: RegistrationCheckoutResumeMode,
): boolean {
  return mode === "pending_session" || mode === "stale_replace";
}
