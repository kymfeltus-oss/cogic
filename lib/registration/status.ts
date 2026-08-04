import type { RegistrationStatus } from "@/lib/registration/types";

/**
 * Domain transition helpers for registration lifecycle.
 * Not security-authoritative — database triggers remain required.
 */

const REGISTRATION_TRANSITIONS: Record<
  RegistrationStatus,
  readonly RegistrationStatus[]
> = {
  draft: ["submitted", "canceled"],
  submitted: ["payment_pending", "confirmed", "canceled"],
  payment_pending: ["confirmed", "submitted", "canceled"],
  confirmed: ["refunded"],
  canceled: [],
  refunded: [],
};

export function canTransitionRegistrationStatus(
  from: RegistrationStatus,
  to: RegistrationStatus,
): boolean {
  if (from === to) return true;
  return REGISTRATION_TRANSITIONS[from].includes(to);
}

export function assertRegistrationStatusTransition(
  from: RegistrationStatus,
  to: RegistrationStatus,
): void {
  if (!canTransitionRegistrationStatus(from, to)) {
    throw new Error(`Invalid registration status transition: ${from} → ${to}`);
  }
}

export function listAllowedRegistrationTransitions(
  from: RegistrationStatus,
): readonly RegistrationStatus[] {
  return REGISTRATION_TRANSITIONS[from];
}

export function isTerminalRegistrationStatus(status: RegistrationStatus): boolean {
  return status === "canceled" || status === "refunded";
}

export function isActiveRegistrationStatus(status: RegistrationStatus): boolean {
  return (
    status === "draft" ||
    status === "submitted" ||
    status === "payment_pending" ||
    status === "confirmed"
  );
}
