export const CREDENTIAL_STATUSES = [
  "issued",
  "active",
  "rotated",
  "revoked",
  "expired",
] as const;

export type CredentialStatus = (typeof CREDENTIAL_STATUSES)[number];

export const USABLE_CREDENTIAL_STATUSES = ["issued", "active"] as const;

export type UsableCredentialStatus = (typeof USABLE_CREDENTIAL_STATUSES)[number];

export const TERMINAL_CREDENTIAL_STATUSES = [
  "rotated",
  "revoked",
  "expired",
] as const;

export type TerminalCredentialStatus =
  (typeof TERMINAL_CREDENTIAL_STATUSES)[number];

export const CREDENTIAL_SCAN_OUTCOMES = [
  "resolved",
  "invalid",
  "rotated",
  "revoked",
  "expired",
  "rate_limited",
  "validated",
  "picked_up",
  "checked_in",
] as const;

export type CredentialScanOutcome = (typeof CREDENTIAL_SCAN_OUTCOMES)[number];

export const CREDENTIAL_SCAN_CHANNELS = [
  "mobile_web",
  "badge_pickup",
  "admin_scanner",
] as const;

export type CredentialScanChannel = (typeof CREDENTIAL_SCAN_CHANNELS)[number];

export const CREDENTIAL_RESOLUTION_OUTCOMES = [
  "resolved",
  "invalid",
  "rotated",
  "revoked",
  "expired",
  "unavailable",
] as const;

export type CredentialResolutionOutcome =
  (typeof CREDENTIAL_RESOLUTION_OUTCOMES)[number];

/**
 * Safe allowlisted resolution DTO for future public credential pages.
 * Never includes registration/credential UUIDs, tokens, hashes, email, phone,
 * address, or payment fields.
 */
export type SafeCredentialResolution = {
  outcome: CredentialResolutionOutcome;
  status?: UsableCredentialStatus;
  badgeCode: string | null;
  firstName: string | null;
  churchName: string | null;
  jurisdiction: string | null;
  programKey: string | null;
};

export type CredentialIssueResult = {
  ok: true;
  credentialId: string;
  registrationId: string;
  credentialVersion: number;
  status: CredentialStatus;
  badgeCode: string;
  issuedAt: string;
  activatedAt: string | null;
  expiresAt: string | null;
  /** Present only on the issuing server call that generated the token. Never persisted. */
  rawTokenOnce?: string;
};

export type CredentialRotateResult = {
  ok: true;
  previousCredentialId: string;
  credentialId: string;
  credentialVersion: number;
  status: CredentialStatus;
  badgeCode: string;
  rotatedAt: string;
  rawTokenOnce?: string;
};

export type CredentialMutationResult = {
  ok: true;
  credentialId: string;
  status: CredentialStatus;
  activatedAt?: string | null;
  revokedAt?: string | null;
};

/**
 * Badge code format (non-secret support lookup):
 * `CS26-` + 8 chars from Crockford Base32 alphabet [0-9A-HJKMNP-TV-Z]
 * Example: CS26-A1B2C3D4
 * Never used as authentication; never derived from the bearer token.
 */
export const BADGE_CODE_PATTERN = /^CS26-[0-9A-HJKMNP-TV-Z]{8}$/;
