import type {
  CredentialStatus,
  TerminalCredentialStatus,
  UsableCredentialStatus,
} from "@/lib/credentials/types";
import {
  TERMINAL_CREDENTIAL_STATUSES,
  USABLE_CREDENTIAL_STATUSES,
} from "@/lib/credentials/types";

const ALLOWED_TRANSITIONS: Record<CredentialStatus, readonly CredentialStatus[]> =
  {
    issued: ["active", "rotated", "revoked", "expired"],
    active: ["rotated", "revoked", "expired"],
    rotated: [],
    revoked: [],
    expired: [],
  };

export function isUsableCredentialStatus(
  status: CredentialStatus,
): status is UsableCredentialStatus {
  return (USABLE_CREDENTIAL_STATUSES as readonly string[]).includes(status);
}

export function isTerminalCredentialStatus(
  status: CredentialStatus,
): status is TerminalCredentialStatus {
  return (TERMINAL_CREDENTIAL_STATUSES as readonly string[]).includes(status);
}

export function canTransitionCredentialStatus(
  from: CredentialStatus,
  to: CredentialStatus,
): boolean {
  if (from === to) return true;
  if (isTerminalCredentialStatus(from)) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertCredentialStatusTransition(
  from: CredentialStatus,
  to: CredentialStatus,
): void {
  if (!canTransitionCredentialStatus(from, to)) {
    throw new Error(`Invalid credential status transition: ${from} → ${to}`);
  }
}

export function isCredentialExpiredAt(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return false;
  const expires =
    typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return expires.getTime() <= now.getTime();
}
