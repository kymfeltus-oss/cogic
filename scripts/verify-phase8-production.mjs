#!/usr/bin/env node
/**
 * Phase 8 production readiness verification (non-transactional, no secret printing).
 *
 * Usage:
 *   node scripts/verify-phase8-production.mjs
 *   PHASE8_VERIFY_BASE_URL=http://localhost:3000 node scripts/verify-phase8-production.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.PHASE8_VERIFY_BASE_URL || "http://localhost:3000";
const EXPECTED_PROJECT = "wjlaaluonxiaxmytiqwi";

const report = {
  authProjectMatch: false,
  requiredEnvNamesPresent: false,
  stripeKeyPresent: false,
  stripeKeyMode: "UNKNOWN",
  webhookSecretPresent: false,
  credentialSessionConfigured: false,
  registrationPricingConfigured: false,
  publicHttpsOriginConfigured: false,
  noVitalOrgansQrFallback: false,
  qrOriginResolverPresent: false,
  healthEndpointReachable: false,
  devBypassesDisabled: false,
  rootMetadataCogicLive: false,
  rateLimitProviderDocumented: false,
  overall: "FAIL",
};

function setCheck(name, pass, detail) {
  report[name] = pass;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function loadEnvFile() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [
          line.slice(0, index).trim(),
          line.slice(index + 1).trim().replace(/^['"]|['"]$/g, ""),
        ];
      }),
  );
}

const envFile = loadEnvFile();

function readEnv(name) {
  return process.env[name]?.trim() || envFile[name]?.trim() || "";
}

function stripeMode(key) {
  if (key.startsWith("sk_live_")) return "LIVE";
  if (key.startsWith("sk_test_")) return "TEST";
  return "UNKNOWN";
}

function isLocalHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost")
  );
}

async function main() {
  const requiredNames = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "REGISTRATION_FEE_CENTS",
    "COGIC_CREDENTIAL_SESSION_SECRET",
    "NEXT_PUBLIC_APP_URL",
    "COGIC_STREAM_PUBLIC_WEB_ORIGIN",
    "ADMIN_EMAILS",
  ];

  const missing = requiredNames.filter((name) => !readEnv(name));
  setCheck(
    "requiredEnvNamesPresent",
    missing.length === 0,
    missing.length ? `missing: ${missing.join(", ")}` : "ok",
  );

  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  setCheck(
    "authProjectMatch",
    supabaseUrl.includes(EXPECTED_PROJECT),
    supabaseUrl ? "project ref checked" : "missing URL",
  );

  const stripeKey = readEnv("STRIPE_SECRET_KEY");
  report.stripeKeyMode = stripeMode(stripeKey);
  setCheck("stripeKeyPresent", stripeKey.length > 0 && !stripeKey.includes("yourActual"));
  console.log(`INFO  stripeKeyMode=${report.stripeKeyMode}`);
  if (report.stripeKeyMode === "LIVE") {
    console.log("INFO  LIVE mode accepted for production");
  }

  setCheck("webhookSecretPresent", readEnv("STRIPE_WEBHOOK_SECRET").length > 0);

  const sessionSecret = readEnv("COGIC_CREDENTIAL_SESSION_SECRET");
  setCheck(
    "credentialSessionConfigured",
    sessionSecret.length >= 32,
    `len=${sessionSecret.length}`,
  );

  const fee = Number.parseInt(readEnv("REGISTRATION_FEE_CENTS"), 10);
  setCheck(
    "registrationPricingConfigured",
    Number.isInteger(fee) && fee > 0,
    Number.isInteger(fee) ? "positive integer present" : "invalid",
  );

  const originRaw =
    readEnv("COGIC_STREAM_PUBLIC_WEB_ORIGIN") || readEnv("NEXT_PUBLIC_APP_URL");
  let originOk = false;
  try {
    const origin = new URL(originRaw);
    const local = isLocalHost(origin.hostname);
    const verifyAsProduction = process.env.PHASE8_VERIFY_REQUIRE_HTTPS === "1";
    if (verifyAsProduction) {
      originOk = origin.protocol === "https:" && !local;
    } else {
      originOk =
        (origin.protocol === "https:" && !local) ||
        (local && (origin.protocol === "http:" || origin.protocol === "https:"));
    }
  } catch {
    originOk = false;
  }
  setCheck(
    "publicHttpsOriginConfigured",
    originOk,
    process.env.PHASE8_VERIFY_REQUIRE_HTTPS === "1"
      ? "HTTPS production origin required"
      : "local http allowed unless PHASE8_VERIFY_REQUIRE_HTTPS=1",
  );

  const qrSource = fs.readFileSync(path.join(ROOT, "lib/credentials/qr-url.ts"), "utf8");
  setCheck(
    "noVitalOrgansQrFallback",
    !qrSource.includes("vitalorgansent"),
    "qr-url.ts must not reference vitalorgansent",
  );
  setCheck(
    "qrOriginResolverPresent",
    qrSource.includes("COGIC_STREAM_PUBLIC_WEB_ORIGIN") &&
      qrSource.includes("resolvePublicWebOrigin"),
  );

  const liveBypass = readEnv("LIVE_ACCESS_DEV_BYPASS").toLowerCase();
  const opsBypass = readEnv("OPS_ADMIN_DEV_BYPASS").toLowerCase();
  setCheck(
    "devBypassesDisabled",
    liveBypass !== "true" && opsBypass !== "true",
    `LIVE_ACCESS_DEV_BYPASS=${liveBypass || "unset"}; OPS_ADMIN_DEV_BYPASS=${opsBypass || "unset"}`,
  );

  const layout = fs.readFileSync(path.join(ROOT, "app/layout.tsx"), "utf8");
  setCheck(
    "rootMetadataCogicLive",
    layout.includes("COGIC_LIVE_PUBLIC_NAME") && !layout.includes('"300 Awakening"'),
  );

  const envExample = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
  setCheck(
    "rateLimitProviderDocumented",
    envExample.includes("REDIS_URL") || envExample.includes("UPSTASH_REDIS_URL"),
  );

  try {
    const response = await fetch(`${BASE}/api/health`, {
      headers: { Accept: "application/json" },
    });
    const bodyText = await response.text();
    const lower = bodyText.toLowerCase();
    const leaked =
      lower.includes("sk_live_") ||
      lower.includes("sk_test_") ||
      lower.includes("whsec_") ||
      lower.includes("service_role") ||
      lower.includes("eyj");
    let jsonOk = false;
    try {
      const json = JSON.parse(bodyText);
      jsonOk =
        typeof json.supabaseConfigured === "boolean" &&
        typeof json.stripeConfigured === "boolean" &&
        typeof json.credentialSessionConfigured === "boolean";
    } catch {
      jsonOk = false;
    }
    setCheck(
      "healthEndpointReachable",
      response.ok || response.status === 503
        ? jsonOk && !leaked
        : false,
      `HTTP ${response.status}${leaked ? " (possible secret leak)" : ""}`,
    );
  } catch (error) {
    setCheck(
      "healthEndpointReachable",
      false,
      error instanceof Error ? error.message : "fetch failed",
    );
  }

  const hard = [
    report.authProjectMatch,
    report.requiredEnvNamesPresent,
    report.stripeKeyPresent,
    report.webhookSecretPresent,
    report.credentialSessionConfigured,
    report.registrationPricingConfigured,
    report.publicHttpsOriginConfigured,
    report.noVitalOrgansQrFallback,
    report.qrOriginResolverPresent,
    report.devBypassesDisabled,
    report.rootMetadataCogicLive,
    report.rateLimitProviderDocumented,
  ];

  report.overall = hard.every(Boolean) ? "PASS" : "FAIL";
  if (!report.healthEndpointReachable) {
    console.log("WARN  healthEndpointReachable — start the app or set PHASE8_VERIFY_BASE_URL");
  }

  console.log("");
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.overall === "PASS" ? 0 : 1);
}

main().catch((error) => {
  console.error("Phase 8 verifier crashed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
