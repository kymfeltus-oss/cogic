#!/usr/bin/env node
/**
 * Validates local auth env vars and prints Supabase Dashboard setup steps
 * for password reset + Google / Facebook / Apple OAuth.
 *
 * Usage: node scripts/verify-auth-config.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ENV_FILES = [".env.local", ".env"];

function loadEnvFile(filename) {
  const path = resolve(ROOT, filename);
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function mergeEnv() {
  const merged = {};
  for (const file of [...ENV_FILES].reverse()) {
    Object.assign(merged, loadEnvFile(file));
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (value != null && value !== "") merged[key] = value;
  }
  return merged;
}

function ok(label) {
  console.log(`  ✓ ${label}`);
}

function warn(label) {
  console.log(`  ! ${label}`);
}

function fail(label) {
  console.log(`  ✗ ${label}`);
}

const env = mergeEnv();
const appUrl = (env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

console.log("\n300 Awakening — Auth configuration check\n");

let issues = 0;

if (!supabaseUrl || supabaseUrl.includes("your-project")) {
  fail("NEXT_PUBLIC_SUPABASE_URL is missing or placeholder");
  issues += 1;
} else {
  ok(`Supabase URL: ${supabaseUrl}`);
}

if (!anonKey || anonKey.includes("your-anon")) {
  fail("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or placeholder");
  issues += 1;
} else {
  ok("Anon/publishable key present");
}

if (!serviceKey || serviceKey.includes("your-service")) {
  warn("SUPABASE_SERVICE_ROLE_KEY missing — guest signup API may fail");
} else {
  ok("Service role key present");
}

ok(`App URL: ${appUrl}`);

const redirectUrls = [
  `${appUrl}/auth/callback`,
  `${appUrl}/auth/callback?next=/attendee-dashboard`,
  `${appUrl}/forgot-password`,
  `${appUrl}/reset-password`,
];

console.log("\nAdd these to Supabase → Authentication → URL Configuration:\n");
console.log(`  Site URL: ${appUrl}`);
console.log("  Redirect URLs:");
for (const url of redirectUrls) {
  console.log(`    - ${url}`);
}

console.log("\nPassword reset (Supabase → Authentication → Email Templates → Reset Password):");
console.log("  Uses redirectTo from /api/auth/forgot-password → /auth/callback → /reset-password");

console.log("\nOAuth providers (Supabase → Authentication → Providers):\n");

const providers = [
  {
    id: "google",
    console: "https://console.cloud.google.com/apis/credentials",
    redirect: `${supabaseUrl}/auth/v1/callback`,
    notes: "OAuth client type: Web. Authorized redirect URI = Supabase callback above.",
  },
  {
    id: "facebook",
    console: "https://developers.facebook.com/apps/",
    redirect: `${supabaseUrl}/auth/v1/callback`,
    notes: "Facebook Login → Valid OAuth Redirect URIs = Supabase callback above.",
  },
  {
    id: "apple",
    console: "https://developer.apple.com/account/resources/identifiers/list/serviceId",
    redirect: `${supabaseUrl}/auth/v1/callback`,
    notes: "Services ID + Sign in with Apple key (.p8). Return URL = Supabase callback above.",
  },
];

for (const provider of providers) {
  console.log(`  ${provider.id.toUpperCase()}`);
  console.log(`    Enable in Supabase Auth → Providers → ${provider.id}`);
  console.log(`    Developer console: ${provider.console}`);
  console.log(`    Redirect URI: ${provider.redirect}`);
  console.log(`    ${provider.notes}\n`);
}

console.log("Local test flow:");
console.log(`  1. Open ${appUrl}/login`);
console.log("  2. Forgot password → enter email → check inbox for Supabase reset email");
console.log("  3. Google / Facebook / Apple → should redirect to provider, then /auth/callback");
console.log("\nRun: node scripts/verify-auth-config.mjs\n");

process.exit(issues > 0 ? 1 : 0);
