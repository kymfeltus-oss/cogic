/**
 * Server-only ADMIN_EMAILS allowlist helpers.
 * Used for application-owner gates (owner console, platform-owner org flag).
 */

function parseAdminEmailAllowlist(): string[] {
  const raw = process.env.ADMIN_EMAILS?.trim();
  if (!raw) return [];

  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/** True when email is listed in comma-separated ADMIN_EMAILS. */
export function isApplicationOwnerEmail(
  email: string | null | undefined,
): boolean {
  if (!email?.trim()) return false;
  return parseAdminEmailAllowlist().includes(email.trim().toLowerCase());
}

/**
 * Temporary event preparation access override.
 * Same allowlist as application owners (ADMIN_EMAILS).
 */
export function isAdminPrepAccessOverrideEmail(
  email: string | null | undefined,
): boolean {
  return isApplicationOwnerEmail(email);
}
