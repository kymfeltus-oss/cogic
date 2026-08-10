import {
  ATTENDEE_DASHBOARD_PATH,
  LEGACY_ATTENDEE_DASHBOARD_PATH,
} from "@/lib/navigation/back-to-dashboard";

export const PERSONA_HUB_PATH = "/email-gate";
export const ATTENDEE_GATE_PATH = "/login";
export const CREATE_ACCOUNT_PATH = "/create-account";
export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const RESET_PASSWORD_PATH = "/reset-password";
export const TEAM_GATE_PATH = "/email-gate/team";
export const AUTH_NEXT_COOKIE = "auth_next";

export const DEFAULT_ATTENDEE_NEXT = ATTENDEE_DASHBOARD_PATH;
export const DEFAULT_TEAM_NEXT = "/owner/control";

const ATTENDEE_PROTECTED_EXACT = new Set(["/dashboard"]);
const ATTENDEE_PROTECTED_PREFIXES = [
  "/experience",
  ATTENDEE_DASHBOARD_PATH,
  LEGACY_ATTENDEE_DASHBOARD_PATH,
  "/register",
  "/my-sanctuary",
];

const TEAM_PROTECTED_PREFIXES: string[] = ["/owner"];

export function sanitizeNextPath(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;

  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  return trimmed;
}

export function buildGateUrl(
  gatePath: string,
  nextPath: string,
  extraParams?: Record<string, string>,
): string {
  const params = new URLSearchParams();
  params.set("next", nextPath);

  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      params.set(key, value);
    }
  }

  return `${gatePath}?${params.toString()}`;
}

export function buildPersonaHubUrl(nextPath?: string | null): string {
  return buildGateUrl(
    PERSONA_HUB_PATH,
    sanitizeNextPath(nextPath, DEFAULT_ATTENDEE_NEXT),
  );
}

export function resolveAttendeeDestination(nextPath: string): string {
  const sanitized = sanitizeNextPath(nextPath, DEFAULT_ATTENDEE_NEXT);
  if (sanitized === "/dashboard" || sanitized === "/experience") {
    return DEFAULT_ATTENDEE_NEXT;
  }
  return sanitized;
}

export function buildAttendeeGateUrl(nextPath?: string | null): string {
  if (!nextPath) return ATTENDEE_GATE_PATH;
  return buildGateUrl(ATTENDEE_GATE_PATH, sanitizeNextPath(nextPath, DEFAULT_ATTENDEE_NEXT));
}

export function buildCreateAccountUrl(nextPath?: string | null): string {
  return buildGateUrl(
    CREATE_ACCOUNT_PATH,
    sanitizeNextPath(nextPath, DEFAULT_ATTENDEE_NEXT),
  );
}

export function buildForgotPasswordUrl(nextPath?: string | null): string {
  return buildGateUrl(
    FORGOT_PASSWORD_PATH,
    sanitizeNextPath(nextPath, DEFAULT_ATTENDEE_NEXT),
  );
}

export function buildResetPasswordUrl(nextPath?: string | null): string {
  return buildGateUrl(
    RESET_PASSWORD_PATH,
    sanitizeNextPath(nextPath, DEFAULT_ATTENDEE_NEXT),
  );
}

/** Client-only — stash return path before navigating to `/login` without query params. */
export function setAuthNextCookie(nextPath: string): void {
  if (typeof document === "undefined") return;
  const safePath = resolveAttendeeDestination(nextPath);
  document.cookie = `${AUTH_NEXT_COOKIE}=${encodeURIComponent(safePath)}; path=/; max-age=600; samesite=lax`;
}

export function clearAuthNextCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_NEXT_COOKIE}=; path=/; max-age=0`;
}

export function buildTeamGateUrl(nextPath?: string | null): string {
  return buildGateUrl(
    TEAM_GATE_PATH,
    resolveTeamDestination(nextPath),
    { persona: "team" },
  );
}

export function isAttendeeProtectedPath(pathname: string): boolean {
  if (ATTENDEE_PROTECTED_EXACT.has(pathname)) return true;
  return ATTENDEE_PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isTeamProtectedPath(pathname: string): boolean {
  return TEAM_PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** True when `next` is a valid post-login destination for production team auth. */
export function isTeamDestinationPath(pathname: string): boolean {
  return isTeamProtectedPath(pathname);
}

/** Strip attendee return paths — team login should never land on attendee surfaces. */
export function resolveTeamDestination(nextPath: string | null | undefined): string {
  const sanitized = sanitizeNextPath(nextPath, DEFAULT_TEAM_NEXT);
  if (isTeamDestinationPath(sanitized)) {
    return sanitized;
  }
  return DEFAULT_TEAM_NEXT;
}

/** Resolve the team destination after gate auth (no redundant query params). */
export function buildTeamPostAuthUrl(nextPath?: string | null): string {
  return resolveTeamDestination(nextPath);
}
