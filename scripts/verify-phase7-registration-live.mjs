#!/usr/bin/env node
/**
 * Phase 7 registration payment live verification (non-transactional).
 *
 * Usage:
 *   node scripts/verify-phase7-registration-live.mjs
 *   PHASE7_VERIFY_BASE_URL=http://localhost:3000 node scripts/verify-phase7-registration-live.mjs
 */

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.PHASE7_VERIFY_BASE_URL || "http://localhost:3000";
const EXPECTED_PROJECT = "wjlaaluonxiaxmytiqwi";

const report = {
  authProjectMatch: false,
  registrationTablesPresent: false,
  fulfillRegistrationCheckoutRpc: false,
  issueRegistrationCredentialRpc: false,
  registrationCheckoutRouteSafe: false,
  registrationPricingConfigured: false,
  stripeKeyPresent: false,
  stripeKeyMode: "UNKNOWN",
  webhookSecretPresent: false,
  credentialSessionSecretPresent: false,
  publicWebOriginPresent: false,
  overall: "FAIL",
};

function setCheck(name, pass, detail) {
  report[name] = pass;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function loadEnvFile() {
  const path = new URL("../.env.local", import.meta.url);
  if (!fs.existsSync(path)) {
    return {};
  }
  return Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
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

async function main() {
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const stripeKey = readEnv("STRIPE_SECRET_KEY");
  const webhookSecret = readEnv("STRIPE_WEBHOOK_SECRET");
  const pricingCents = readEnv("REGISTRATION_FEE_CENTS");

  setCheck(
    "authProjectMatch",
    supabaseUrl.includes(EXPECTED_PROJECT),
    supabaseUrl || "missing NEXT_PUBLIC_SUPABASE_URL",
  );

  if (!serviceRole) {
    setCheck("registrationTablesPresent", false, "missing SUPABASE_SERVICE_ROLE_KEY");
    setCheck("fulfillRegistrationCheckoutRpc", false, "missing service role");
    setCheck("issueRegistrationCredentialRpc", false, "missing service role");
  } else {
    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const tables = await Promise.all([
      admin.from("registrations").select("id", { head: true, count: "exact" }),
      admin.from("registration_payments").select("id", { head: true, count: "exact" }),
      admin.from("registration_credentials").select("id", { head: true, count: "exact" }),
    ]);

    setCheck(
      "registrationTablesPresent",
      tables.every((result) => !result.error),
      tables.map((result) => result.error?.message).filter(Boolean).join("; ") || "ok",
    );

    const fulfill = await admin.rpc("fulfill_registration_checkout", {
      p_stripe_session_id: "__phase7_probe__",
      p_stripe_payment_intent_id: null,
    });
    setCheck(
      "fulfillRegistrationCheckoutRpc",
      Boolean(fulfill.error && /not found|requires|payment_pending|registration payment/i.test(fulfill.error.message)),
      fulfill.error?.message || "unexpected success",
    );

    const issue = await admin.rpc("issue_registration_credential", {
      p_registration_id: "00000000-0000-0000-0000-000000000000",
      p_token_hash_hex: "00".repeat(32),
      p_badge_code: "PHASE7",
      p_actor_user_id: null,
      p_expires_at: null,
      p_activate: false,
    });
    setCheck(
      "issueRegistrationCredentialRpc",
      Boolean(issue.error),
      issue.error?.message || "unexpected success",
    );
  }

  try {
    const response = await fetch(`${BASE}/api/registration/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    setCheck(
      "registrationCheckoutRouteSafe",
      response.status === 401,
      `HTTP ${response.status}`,
    );
  } catch (error) {
    setCheck(
      "registrationCheckoutRouteSafe",
      false,
      error instanceof Error ? error.message : "fetch failed",
    );
  }

  const pricingConfigured =
    pricingCents.length > 0 &&
    Number.isInteger(Number.parseInt(pricingCents, 10)) &&
    Number.parseInt(pricingCents, 10) > 0;
  setCheck(
    "registrationPricingConfigured",
    pricingConfigured,
    pricingConfigured ? `${pricingCents} cents` : "REGISTRATION_FEE_CENTS not set",
  );

  setCheck("stripeKeyPresent", stripeKey.length > 0 && !stripeKey.includes("yourActual"));
  if (stripeKey.startsWith("sk_live_")) {
    report.stripeKeyMode = "LIVE";
  } else if (stripeKey.startsWith("sk_test_")) {
    report.stripeKeyMode = "TEST";
  } else {
    report.stripeKeyMode = "UNKNOWN";
  }
  console.log(`INFO  stripeKeyMode=${report.stripeKeyMode}`);

  setCheck(
    "webhookSecretPresent",
    webhookSecret.length > 0 && !webhookSecret.includes("your-webhook"),
  );
  setCheck("credentialSessionSecretPresent", readEnv("COGIC_CREDENTIAL_SESSION_SECRET").length >= 32);
  setCheck("publicWebOriginPresent", readEnv("COGIC_STREAM_PUBLIC_WEB_ORIGIN").length > 0);

  const hardChecks = [
    "authProjectMatch",
    "registrationTablesPresent",
    "fulfillRegistrationCheckoutRpc",
    "issueRegistrationCredentialRpc",
    "registrationCheckoutRouteSafe",
  ];

  report.overall = hardChecks.every((key) => report[key] === true) ? "PASS" : "FAIL";

  console.log("\n=== Phase 7 registration verifier ===");
  console.log(JSON.stringify(report, null, 2));

  if (report.overall !== "PASS") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("PHASE7_VERIFY_FAIL", error);
  process.exit(1);
});

