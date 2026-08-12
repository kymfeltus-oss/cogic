import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getReadiness, getSystemReadinessStatus } from "@/lib/health/readiness";
import {
  assertSafeRegistrationEnvironment,
  assessMockRegistrationDisabled,
  isMockRegistrationEnabled,
  isMockRegistrationFlagEnabled,
  isRegistrationProductionBoundary,
  registrationDemoModeAllowed,
  resolveRegistrationRuntimeBoundary,
} from "@/lib/registration/runtime-mode";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (typeof value === "string") {
      process.env[key] = value;
    }
  }
}

function setProductionLikeEnv() {
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  process.env.VERCEL_ENV = "production";
  process.env.COGIC_RUNTIME_ENV = "production";
  process.env.USE_MOCK_REGISTRATION = "true";
  process.env.LIVE_ACCESS_DEV_BYPASS = "false";
  process.env.OPS_ADMIN_DEV_BYPASS = "false";
  process.env.ATTENDEE_AUTH_OPEN = "false";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test-key";
  process.env.STRIPE_SECRET_KEY = "sk_test_example";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
  process.env.COGIC_CREDENTIAL_SESSION_SECRET = "x".repeat(32);
  process.env.REGISTRATION_FEE_CENTS = "25000";
  process.env.REGISTRATION_CURRENCY = "usd";
  process.env.NEXT_PUBLIC_APP_URL = "https://live.example.org";
  process.env.COGIC_STREAM_PUBLIC_WEB_ORIGIN = "https://live.example.org";
}

afterEach(() => {
  resetEnv();
});

describe("registration runtime mode / environment boundary", () => {
  it("treats Vercel production as the production boundary", () => {
    assert.equal(
      resolveRegistrationRuntimeBoundary({
        VERCEL_ENV: "production",
        NODE_ENV: "production",
      }),
      "production",
    );
    assert.equal(
      isRegistrationProductionBoundary({
        VERCEL_ENV: "production",
        NODE_ENV: "production",
      }),
      true,
    );
  });

  it("does not treat Vercel preview as production even when NODE_ENV=production", () => {
    assert.equal(
      resolveRegistrationRuntimeBoundary({
        VERCEL_ENV: "preview",
        NODE_ENV: "production",
      }),
      "preview",
    );
    assert.equal(
      registrationDemoModeAllowed({
        VERCEL_ENV: "preview",
        NODE_ENV: "production",
        USE_MOCK_REGISTRATION: "true",
      }),
      true,
    );
  });

  it("never allows registration demo mode inside the production boundary", () => {
    assert.equal(
      isMockRegistrationEnabled({
        VERCEL_ENV: "production",
        USE_MOCK_REGISTRATION: "true",
      }),
      false,
    );
    assert.equal(
      registrationDemoModeAllowed({
        VERCEL_ENV: "production",
        USE_MOCK_REGISTRATION: "true",
      }),
      false,
    );
    assert.equal(isMockRegistrationFlagEnabled({ USE_MOCK_REGISTRATION: "true" }), true);
  });

  it("throws on CRITICAL MISCONFIGURATION when mock flag is set in production", () => {
    assert.throws(
      () =>
        assertSafeRegistrationEnvironment({
          VERCEL_ENV: "production",
          NODE_ENV: "production",
          USE_MOCK_REGISTRATION: "true",
        }),
      /CRITICAL MISCONFIGURATION: USE_MOCK_REGISTRATION cannot be enabled in a production environment/,
    );

    assert.doesNotThrow(() =>
      assertSafeRegistrationEnvironment({
        VERCEL_ENV: "preview",
        NODE_ENV: "production",
        USE_MOCK_REGISTRATION: "true",
      }),
    );
  });

  it("fails closed immediately when mock flag is enabled under production variables", () => {
    const assessment = assessMockRegistrationDisabled({
      VERCEL_ENV: "production",
      NODE_ENV: "production",
      USE_MOCK_REGISTRATION: "true",
    });
    assert.equal(assessment.mockRegistrationDisabled, false);
    assert.equal(assessment.failClosedImmediate, true);
    assert.equal(assessment.boundary, "production");

    setProductionLikeEnv();
    const readiness = getReadiness();
    assert.equal(readiness.mockRegistrationDisabled, false);
    assert.equal(readiness.status, "not_ready");
    assert.match(readiness.reason ?? "", /BLOCKED: USE_MOCK_REGISTRATION/);
    assert.equal(isMockRegistrationEnabled(), false);

    const system = getSystemReadinessStatus({
      VERCEL_ENV: "production",
      NODE_ENV: "production",
      USE_MOCK_REGISTRATION: "true",
    });
    assert.equal(system.status, "UNHEALTHY");
    assert.equal(system.ready, false);
    assert.equal(system.mockRegistrationDisabled, false);
    assert.match(system.reason ?? "", /BLOCKED: USE_MOCK_REGISTRATION/);
  });

  it("keeps readiness not_ready when mock flag is on outside production", () => {
    const assessment = assessMockRegistrationDisabled({
      VERCEL_ENV: "preview",
      NODE_ENV: "production",
      USE_MOCK_REGISTRATION: "true",
    });
    assert.equal(assessment.mockRegistrationDisabled, false);
    assert.equal(assessment.failClosedImmediate, false);

    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.VERCEL_ENV = "preview";
    process.env.USE_MOCK_REGISTRATION = "true";
    process.env.LIVE_ACCESS_DEV_BYPASS = "false";
    process.env.OPS_ADMIN_DEV_BYPASS = "false";
    process.env.ATTENDEE_AUTH_OPEN = "false";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test-key";
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    process.env.COGIC_CREDENTIAL_SESSION_SECRET = "x".repeat(32);
    process.env.REGISTRATION_FEE_CENTS = "25000";
    process.env.NEXT_PUBLIC_APP_URL = "https://preview.example.org";

    const readiness = getReadiness();
    assert.equal(readiness.mockRegistrationDisabled, false);
    assert.equal(readiness.status, "not_ready");
  });

  it("reports mockRegistrationDisabled when the flag is false", () => {
    const assessment = assessMockRegistrationDisabled({
      VERCEL_ENV: "production",
      USE_MOCK_REGISTRATION: "false",
    });
    assert.equal(assessment.mockRegistrationDisabled, true);
    assert.equal(assessment.failClosedImmediate, false);
  });

  it("wires readiness assessment and production cron path into the repo", () => {
    const readiness = read("lib/health/readiness.ts");
    const vercel = read("vercel.json");
    const pkg = read("package.json");
    const cronRoute = read("app/api/cron/process-registration-credentials/route.ts");
    const envExample = read(".env.example");
    const runbook = read("docs/REGISTRATION_OPERATIONS_RUNBOOK.md");
    const migration = read(
      "supabase/migrations/20260812040000_registration_admin_operations.sql",
    );

    assert.match(readiness, /assessMockRegistrationDisabled/);
    assert.match(readiness, /isMockRegistrationEnabled/);
    assert.match(readiness, /getSystemReadinessStatus/);
    assert.match(readiness, /mockRegistrationDisabled/);
    assert.match(readiness, /failClosedImmediate/);
    assert.match(readiness, /BLOCKED: USE_MOCK_REGISTRATION is active on a production runtime instance/);

    const runtimeMode = read("lib/registration/runtime-mode.ts");
    assert.match(runtimeMode, /export function isMockRegistrationEnabled/);
    assert.match(runtimeMode, /export function assertSafeRegistrationEnvironment/);
    assert.match(
      runtimeMode,
      /CRITICAL MISCONFIGURATION: USE_MOCK_REGISTRATION cannot be enabled in a production environment/,
    );

    assert.match(vercel, /\/api\/cron\/process-registration-credentials/);
    assert.match(pkg, /\/api\/cron\/process-registration-credentials/);
    assert.match(cronRoute, /processDueRegistrationCredentialJobs/);
    assert.match(cronRoute, /CRON_SECRET/);

    assert.match(envExample, /USE_MOCK_REGISTRATION=false/);
    assert.match(envExample, /Operator Smoke Test Checklist/);
    assert.match(runbook, /Core transaction management/i);
    assert.match(runbook, /Automated queue executions/i);
    assert.match(runbook, /Manual exception settlement/i);
    assert.match(runbook, /process-registration-credentials/);
    assert.match(runbook, /cannot be overriden using manual|no.*manual.*mark paid/i);
    assert.match(runbook, /status IN \('pending', 'processing', 'retry', 'failed'\)/);

    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.registration_refund_operations/);
    assert.match(migration, /correct_registration_attendee/);
    assert.match(migration, /firstName/);
    assert.match(migration, /interpretationLanguage/);
    assert.match(migration, /juniorDob/);
    assert.match(migration, /FOR UPDATE/);
    assert.doesNotMatch(
      migration,
      /p_amount_cents|p_status|amountCents.*UPDATE|status.*allowlist/i,
    );
  });

  it("wires sandbox payment and credential interceptors behind the non-production guard", () => {
    const interceptor = read("lib/registration/sandbox-interceptors.ts");
    const checkout = read("lib/registration/checkout.ts");
    const credential = read("app/api/registration/credential-presentation/route.ts");
    assert.match(interceptor, /isMockRegistrationEnabled/);
    assert.match(interceptor, /sandbox: true/);
    assert.match(interceptor, /persisted: false/);
    assert.match(checkout, /interceptRegistrationCheckout/);
    assert.match(credential, /interceptRegistrationCredential/);
    assert.equal(isMockRegistrationFlagEnabled({ USE_MOCK_REGISTRATION: "true" }), true);
    assert.equal(registrationDemoModeAllowed({ VERCEL_ENV: "production", USE_MOCK_REGISTRATION: "true" }), false);
    assert.equal(registrationDemoModeAllowed({ VERCEL_ENV: "preview", USE_MOCK_REGISTRATION: "true" }), true);
  });
});
