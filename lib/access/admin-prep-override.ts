/**
 * Temporary event preparation access override.
 * Server-only — reads ADMIN_EMAILS to bypass Stripe ticket lookup for listed operators.
 */

function parseAdminEmailAllowlist(): string[] {
  const raw = process.env.ADMIN_EMAILS?.trim();
  if (!raw) return [];

  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/** Temporary event preparation access override. */
export function isAdminPrepAccessOverrideEmail(
  email: string | null | undefined,
): boolean {
  if (!email?.trim()) return false;
  return parseAdminEmailAllowlist().includes(email.trim().toLowerCase());
}
