#!/usr/bin/env node
/**
 * Track 3 — Operator smoke CLI for tax-exempt review transitions.
 *
 * Does NOT fake certificates. verify/reject only works on real pending_review rows
 * that passed upload + confirm (certificate_object_path present in storage).
 *
 * Usage:
 *   OPERATOR_SMOKE_ENABLED=true \
 *   REVIEWER_USER_ID=<auth.users uuid> \
 *   npx tsx scripts/smoke/tax-exempt-operator-smoke.mjs list-pending
 *
 *   OPERATOR_SMOKE_ENABLED=true \
 *   REVIEWER_USER_ID=<uuid> \
 *   PROFILE_ID=<church_tax_profiles.id> \
 *   npx tsx scripts/smoke/tax-exempt-operator-smoke.mjs verify
 *
 *   OPERATOR_SMOKE_ENABLED=true \
 *   REVIEWER_USER_ID=<uuid> \
 *   PROFILE_ID=<uuid> \
 *   INTERNAL_NOTES="Smoke rejection" \
 *   npx tsx scripts/smoke/tax-exempt-operator-smoke.mjs reject
 */

import { createRequire } from "node:module";
import { writeSync } from "node:fs";

const require = createRequire(import.meta.url);

// Inject a client-safe mock into Node's module resolution cache to satisfy the boundary check
// when this script runs outside the Next.js bundler (tsx standalone runner).
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  exports: {},
  loaded: true,
};

const command = process.argv[2] || "help";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Bypass Windows libuv UV_HANDLE_CLOSING teardown when Supabase handles are still open. */
class SmokeCliExit extends Error {
  constructor(code) {
    super(`Smoke CLI exit ${code}`);
    this.exitCode = code;
  }
}

function fatalExit(code = 1) {
  process.exitCode = code;
  if (code === 0) {
    process.exit(0);
    return;
  }
  try {
    writeSync(2, "");
  } catch {
    // ignore flush failures
  }
  setTimeout(() => process.abort(), 0);
  throw new SmokeCliExit(code);
}

function requireUuid(envName, raw) {
  const value = raw?.trim() ?? "";
  if (!value) {
    console.error(`${envName} is required.`);
    process.exit(1);
  }
  if (value.includes("<") || value.includes(">") || /your-/i.test(value)) {
    console.error(`${envName} still looks like a placeholder (${value}).`);
    console.error(
      "Replace it with a real UUID — do not paste the angle-bracket example text.",
    );
    process.exit(1);
  }
  if (!UUID_RE.test(value)) {
    console.error(
      `${envName} must be a UUID (example: 11111111-1111-4111-8111-111111111111).`,
    );
    console.error(`Received: ${value}`);
    process.exit(1);
  }
  return value;
}

function resolveCommandEnv() {
  if (command === "help") {
    console.log(`Commands: list-pending | status-by-church | verify | reject`);
    process.exit(0);
  }

  if (process.env.OPERATOR_SMOKE_ENABLED?.trim().toLowerCase() !== "true") {
    console.error("BLOCKED: set OPERATOR_SMOKE_ENABLED=true");
    process.exit(1);
  }

  if (command === "status-by-church") {
    return { churchId: requireUuid("CHURCH_ID", process.env.CHURCH_ID) };
  }

  if (command === "verify" || command === "reject") {
    return {
      profileId: requireUuid("PROFILE_ID", process.env.PROFILE_ID),
      reviewerUserId: requireUuid("REVIEWER_USER_ID", process.env.REVIEWER_USER_ID),
    };
  }

  if (command !== "list-pending") {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }

  return {};
}

async function main() {
  const env = resolveCommandEnv();

  const {
    operatorGetTaxProfileByChurchId,
    operatorListPendingTaxProfiles,
    operatorReviewTaxProfile,
  } = await import("../../lib/travel/corporate/tax-exempt-operator-smoke.ts");

  if (command === "list-pending") {
    const rows = await operatorListPendingTaxProfiles(50);
    console.log(JSON.stringify({ count: rows.length, profiles: rows }, null, 2));
    return;
  }

  if (command === "status-by-church") {
    const row = await operatorGetTaxProfileByChurchId(env.churchId);
    console.log(JSON.stringify(row, null, 2));
    return;
  }

  if (command === "verify") {
    const profile = await operatorReviewTaxProfile({
      profileId: env.profileId,
      action: "verify",
      reviewerUserId: env.reviewerUserId,
      internalNotes: process.env.INTERNAL_NOTES?.trim() || "Operator smoke verify",
    });
    console.log(JSON.stringify({ ok: true, profile }, null, 2));
    return;
  }

  if (command === "reject") {
    const notes = process.env.INTERNAL_NOTES?.trim() || "Operator smoke reject";
    const profile = await operatorReviewTaxProfile({
      profileId: env.profileId,
      action: "reject",
      reviewerUserId: env.reviewerUserId,
      internalNotes: notes,
    });
    console.log(JSON.stringify({ ok: true, profile }, null, 2));
    return;
  }
}

main().catch((error) => {
  if (error instanceof SmokeCliExit) {
    return;
  }
  console.error("\n💥 CRITICAL RUNTIME EXCEPTION DETECTED:");
  if (typeof error === "object" && error !== null) {
    console.error(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    if (error.stack) console.error(error.stack);
  } else {
    console.error(error);
  }
  fatalExit(1);
});
