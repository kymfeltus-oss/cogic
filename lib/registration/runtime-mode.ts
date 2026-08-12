/**
 * Registration Hub runtime environment boundary.
 *
 * SERVER AUTHORITY / DEFINE THE ENVIRONMENT BOUNDARY:
 * - Live production and Vercel production must never serve mock registration data.
 * - USE_MOCK_REGISTRATION is a local/sandbox switch only.
 * - Readiness fails closed when the mock flag is present inside production bounds.
 */

export type RegistrationRuntimeBoundary =
  | "production"
  | "preview"
  | "development"
  | "unknown";

export type MockRegistrationAssessment = {
  /** True when mock registration is not enabled (required for readiness). */
  mockRegistrationDisabled: boolean;
  /** True when readiness must return not_ready immediately. */
  failClosedImmediate: boolean;
  boundary: RegistrationRuntimeBoundary;
  mockFlagEnabled: boolean;
  reason: string;
};

/** Accept full process.env or partial test fixtures without requiring NODE_ENV. */
export type RegistrationEnvInput = NodeJS.ProcessEnv | Record<string, string | undefined>;

function normalizeEnvFlag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

/**
 * Resolve the active deployment boundary from environment variables.
 * Vercel Preview sets NODE_ENV=production — that alone is not the production boundary.
 */
export function resolveRegistrationRuntimeBoundary(
  env: RegistrationEnvInput = process.env,
): RegistrationRuntimeBoundary {
  const vercelEnv = env.VERCEL_ENV?.trim().toLowerCase();
  if (vercelEnv === "production") {
    return "production";
  }
  if (vercelEnv === "preview") {
    return "preview";
  }
  if (vercelEnv === "development") {
    return "development";
  }

  const cogicRuntime = env.COGIC_RUNTIME_ENV?.trim().toLowerCase();
  if (cogicRuntime === "production") {
    return "production";
  }
  if (cogicRuntime === "preview") {
    return "preview";
  }
  if (cogicRuntime === "development") {
    return "development";
  }

  if (env.NODE_ENV === "production") {
    // Bare NODE_ENV=production without Vercel/COGIC markers — treat as production host.
    return "production";
  }
  if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
    return "development";
  }
  return "unknown";
}

export function isRegistrationProductionBoundary(
  env: RegistrationEnvInput = process.env,
): boolean {
  return resolveRegistrationRuntimeBoundary(env) === "production";
}

/** Raw flag check — does not authorize demo mode by itself. */
export function isMockRegistrationFlagEnabled(
  env: RegistrationEnvInput = process.env,
): boolean {
  return normalizeEnvFlag(env.USE_MOCK_REGISTRATION);
}

/**
 * Effective mock registration mode (sandbox only).
 * Inside a definitive production boundary this always returns false even when
 * USE_MOCK_REGISTRATION=true — simulated configs never activate on production nodes.
 *
 * Vercel Preview sets NODE_ENV=production; that alone is not the production boundary.
 * Production boundary = VERCEL_ENV=production | COGIC_RUNTIME_ENV=production |
 * bare NODE_ENV=production without a preview/development Vercel marker.
 */
export function isMockRegistrationEnabled(
  env: RegistrationEnvInput = process.env,
): boolean {
  if (isRegistrationProductionBoundary(env)) {
    return false;
  }
  return isMockRegistrationFlagEnabled(env);
}

/**
 * Sandbox demo mode may only activate outside the production boundary.
 * Alias of isMockRegistrationEnabled for readiness / interceptor call sites.
 */
export function registrationDemoModeAllowed(
  env: RegistrationEnvInput = process.env,
): boolean {
  return isMockRegistrationEnabled(env);
}

/**
 * Hard fail-safe for bootstrapping registration surfaces that must never run
 * with a production + mock misconfiguration. Prefer readiness not_ready for
 * /api/health; use this where a thrown critical error is the correct stop.
 */
export function assertSafeRegistrationEnvironment(
  env: RegistrationEnvInput = process.env,
): void {
  if (
    isMockRegistrationFlagEnabled(env) &&
    isRegistrationProductionBoundary(env)
  ) {
    throw new Error(
      "CRITICAL MISCONFIGURATION: USE_MOCK_REGISTRATION cannot be enabled in a production environment.",
    );
  }
}

/**
 * Readiness assessment for mockRegistrationDisabled.
 * When the mock flag is enabled under a production boundary, fail closed immediately.
 */
export function assessMockRegistrationDisabled(
  env: RegistrationEnvInput = process.env,
): MockRegistrationAssessment {
  const boundary = resolveRegistrationRuntimeBoundary(env);
  const mockFlagEnabled = isMockRegistrationFlagEnabled(env);

  if (!mockFlagEnabled) {
    return {
      mockRegistrationDisabled: true,
      failClosedImmediate: false,
      boundary,
      mockFlagEnabled: false,
      reason: "USE_MOCK_REGISTRATION is unset or false.",
    };
  }

  if (boundary === "production") {
    return {
      mockRegistrationDisabled: false,
      failClosedImmediate: true,
      boundary,
      mockFlagEnabled: true,
      reason:
        "USE_MOCK_REGISTRATION=true is forbidden inside the production / Vercel production boundary.",
    };
  }

  // Flag set outside production: readiness still reports mock as enabled (not disabled)
  // so operators cannot claim production-ready while sandbox mode is on.
  return {
    mockRegistrationDisabled: false,
    failClosedImmediate: false,
    boundary,
    mockFlagEnabled: true,
    reason:
      "USE_MOCK_REGISTRATION=true is active outside production. Readiness stays not_ready until the flag is cleared.",
  };
}
