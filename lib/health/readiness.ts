import { resolveRegistrationPricingConfig } from "@/lib/registration/pricing-core";
import { isDistributedRateLimitConfigured } from "@/lib/rate-limit/redis-store";

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
};

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

export function getLiveness(): HealthLiveness {
  return { status: "ok" };
}

export function getReadiness(): HealthReadiness {
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

  const ready =
    supabaseConfigured &&
    stripeConfigured &&
    stripeWebhookConfigured &&
    credentialSessionConfigured &&
    originConfigured &&
    registrationPricingConfigured &&
    liveAccessDevBypassDisabled &&
    opsAdminDevBypassDisabled;

  return {
    status: ready ? "ready" : "not_ready",
    supabaseConfigured,
    stripeConfigured,
    stripeWebhookConfigured,
    credentialSessionConfigured,
    publicHttpsOriginConfigured: originConfigured,
    registrationPricingConfigured,
    rateLimitConfigured,
    liveAccessDevBypassDisabled,
    opsAdminDevBypassDisabled,
  };
}
