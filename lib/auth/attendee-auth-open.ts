/**
 * Temporary open-browse mode for attendee surfaces.
 * When enabled, anonymous visitors can reach the dashboard without login.
 * Server-only — never expose via NEXT_PUBLIC_.
 *
 * Defaults ON outside production so local preview works without login.
 * Set ATTENDEE_AUTH_OPEN=false to restore the login gate locally.
 * Production requires ATTENDEE_AUTH_OPEN unset/false for readiness.
 */
export function isAttendeeAuthOpen(): boolean {
  const raw = process.env.ATTENDEE_AUTH_OPEN?.trim().toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  return process.env.NODE_ENV !== "production";
}
