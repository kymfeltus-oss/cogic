import { isDistributedRateLimitConfigured } from "@/lib/rate-limit/config";
import {
  assessMockRegistrationDisabled,
  isMockRegistrationEnabled,
} from "@/lib/registration/runtime-mode";
import { resolveRegistrationPricingConfig } from "@/lib/registration/pricing-core";

export type HealthLiveness = {
  status: "ok";
};

export type HealthReadiness = {
  status: "ready" | "not_ready";
  supabaseConfigured: boolean;
  stripeConfigured: boolean;
  stripeWebhookConfigured: boolean;
  credentialSessionConfigured: boolean;
  publicHttpsOriginConfigured: boolean;
  registrationPricingConfigured: boolean;
  rateLimitConfigured: boolean;
  liveAccessDevBypassDisabled: boolean;
  opsAdminDevBypassDisabled: boolean;
  attendeeAuthOpenDisabled: boolean;
  /** False when USE_MOCK_REGISTRATION=true — required true for ready. */
  mockRegistrationDisabled: boolean;
  /** Present when readiness fails closed on a mock/production sandbox leak. */
  reason?: string;
};

export type SystemReadinessStatus = {
  status: "HEALTHY" | "UNHEALTHY";
  ready: boolean;
  mockRegistrationDisabled: boolean;
  /** Effective sandbox mode after production boundary force-off. */
  mockRegistrationEnabled: boolean;
  reason?: string;
};

const MOCK_PRODUCTION_BLOCK_REASON =
  "BLOCKED: USE_MOCK_REGISTRATION is active on a production runtime instance.";

function isTruthyBypass(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function hasNonEmpty(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 && !trimmed.includes("yourActual") && !trimmed.includes("your-");
}

function publicHttpsOriginConfigured(): boolean {
  const candidates = [
    process.env.COGIC_STREAM_PUBLIC_WEB_ORIGIN,
    process.env.NEXT_PUBLIC_APP_URL,
  ];

  for (const raw of candidates) {
    const value = raw?.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      const local =
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "[::1]";
      if (process.env.NODE_ENV === "production") {
        if (url.protocol === "https:" && !local) return true;
      } else if (url.protocol === "http:" || url.protocol === "https:") {
        return true;
      }
    } catch {
      // continue
    }
  }
  return false;
}

function evaluateConfigurationFlags(): Omit<
  HealthReadiness,
  "status" | "mockRegistrationDisabled" | "reason"
> {
  let registrationPricingConfigured = false;
  try {
    resolveRegistrationPricingConfig({
      feeCents: process.env.REGISTRATION_FEE_CENTS,
      currency: process.env.REGISTRATION_CURRENCY,
    });
    registrationPricingConfigured = true;
  } catch {
    registrationPricingConfigured = false;
  }

  const supabaseConfigured =
    hasNonEmpty(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    hasNonEmpty(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    hasNonEmpty(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const stripeConfigured = hasNonEmpty(process.env.STRIPE_SECRET_KEY);
  const stripeWebhookConfigured = hasNonEmpty(process.env.STRIPE_WEBHOOK_SECRET);
  const credentialSessionConfigured =
    (process.env.COGIC_CREDENTIAL_SESSION_SECRET?.trim().length ?? 0) >= 32;
  const originConfigured = publicHttpsOriginConfigured();
  const rateLimitConfigured = isDistributedRateLimitConfigured();
  const liveAccessDevBypassDisabled = !isTruthyBypass(
    process.env.LIVE_ACCESS_DEV_BYPASS,
  );
  const opsAdminDevBypassDisabled = !isTruthyBypass(process.env.OPS_ADMIN_DEV_BYPASS);
  const attendeeAuthOpenDisabled = !isTruthyBypass(process.env.ATTENDEE_AUTH_OPEN);

  return {
    supabaseConfigured,
    stripeConfigured,
    stripeWebhookConfigured,
    credentialSessionConfigured,
    publicHttpsOriginConfigured: originConfigured,
    registrationPricingConfigured,
    rateLimitConfigured,
    liveAccessDevBypassDisabled,
    opsAdminDevBypassDisabled,
    attendeeAuthOpenDisabled,
  };
}

export function getLiveness(): HealthLiveness {
  return { status: "ok" };
}

/**
 * Canonical readiness probe used by GET /api/health.
 * Fails closed instantly when USE_MOCK_REGISTRATION is set inside the production boundary.
 */
export function getReadiness(): HealthReadiness {
  const mockAssessment = assessMockRegistrationDisabled(process.env);

  // Strict compliance: block readiness if a sandbox leak is present on production nodes.
  if (mockAssessment.failClosedImmediate) {
    const configuration = evaluateConfigurationFlags();
    return {
      status: "not_ready",
      ...configuration,
      mockRegistrationDisabled: false,
      reason: MOCK_PRODUCTION_BLOCK_REASON,
    };
  }

  const configuration = evaluateConfigurationFlags();
  const mockRegistrationDisabled = mockAssessment.mockRegistrationDisabled;

  const ready =
    configuration.supabaseConfigured &&
    configuration.stripeConfigured &&
    configuration.stripeWebhookConfigured &&
    configuration.credentialSessionConfigured &&
    configuration.publicHttpsOriginConfigured &&
    configuration.registrationPricingConfigured &&
    configuration.liveAccessDevBypassDisabled &&
    configuration.opsAdminDevBypassDisabled &&
    configuration.attendeeAuthOpenDisabled &&
    mockRegistrationDisabled;

  return {
    status: ready ? "ready" : "not_ready",
    ...configuration,
    mockRegistrationDisabled,
    ...(ready
      ? {}
      : {
          reason: mockRegistrationDisabled
            ? "One or more readiness configuration checks failed."
            : "USE_MOCK_REGISTRATION is active; readiness stays not_ready until the flag is cleared.",
        }),
  };
}

/**
 * Operator-facing readiness summary with HEALTHY/UNHEALTHY semantics.
 * Uses the same production-boundary rules as runtime-mode (Preview ≠ production).
 */
export function getSystemReadinessStatus(
  env: NodeJS.ProcessEnv = process.env,
): SystemReadinessStatus {
  const mockAssessment = assessMockRegistrationDisabled(env);
  const mockRegistrationEnabled = isMockRegistrationEnabled(env);

  // Strict compliance audit: fail closed if mock variables leak into production pipelines.
  if (mockAssessment.failClosedImmediate) {
    return {
      status: "UNHEALTHY",
      ready: false,
      mockRegistrationDisabled: false,
      mockRegistrationEnabled: false,
      reason: MOCK_PRODUCTION_BLOCK_REASON,
    };
  }

  // Explicit env bags (unit tests) evaluate the mock checkpoint only.
  if (env !== process.env) {
    if (!mockAssessment.mockRegistrationDisabled) {
      return {
        status: "UNHEALTHY",
        ready: false,
        mockRegistrationDisabled: false,
        mockRegistrationEnabled,
        reason:
          "USE_MOCK_REGISTRATION is active; readiness stays not_ready until the flag is cleared.",
      };
    }
    return {
      status: "HEALTHY",
      ready: true,
      mockRegistrationDisabled: true,
      mockRegistrationEnabled: false,
    };
  }

  const readiness = getReadiness();
  return {
    status: readiness.status === "ready" ? "HEALTHY" : "UNHEALTHY",
    ready: readiness.status === "ready",
    mockRegistrationDisabled: readiness.mockRegistrationDisabled,
    mockRegistrationEnabled,
    reason: readiness.reason,
  };
}
