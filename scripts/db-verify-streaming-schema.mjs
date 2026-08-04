#!/usr/bin/env node
/**
 * Verify streaming_destinations wizard + validation columns on linked Supabase.
 * Usage: npm run db:verify:streaming
 */
import { execSync } from "node:child_process";

const SETUP_PROFILE_COLUMNS = [
  "channel_id",
  "channel_name",
  "profile_image_url",
  "oauth_permissions_json",
  "last_authenticated_at",
  "last_stream_at",
  "stream_category",
  "scheduled_start_at",
  "stream_tags",
  "video_profile_json",
  "audio_profile_json",
  "encoder_profile_json",
  "network_test_json",
  "connection_quality",
  "latency_mode",
];

const VALIDATION_COLUMNS = [
  "oauth_status",
  "permission_status",
  "quota_status",
  "live_permission_status",
  "rtmp_status",
  "destination_status",
  "last_validated_at",
  "last_successful_validation_at",
  "last_validation_error",
];

const REQUIRED = [...SETUP_PROFILE_COLUMNS, ...VALIDATION_COLUMNS];

const sql = `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'streaming_destinations' ORDER BY ordinal_position;`;

let stdout = "";
try {
  stdout = execSync(`npx supabase db query --linked ${JSON.stringify(sql)} -o json`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
} catch (err) {
  console.error("Failed to query linked Supabase. Is the project linked?");
  console.error(err.stderr?.toString() ?? err.message);
  process.exit(1);
}

let rows = [];
try {
  const parsed = JSON.parse(stdout);
  rows = parsed.rows ?? [];
} catch {
  console.error("Unexpected CLI output:", stdout.slice(0, 500));
  process.exit(1);
}

const present = new Set(rows.map((r) => r.column_name));
const missingSetup = SETUP_PROFILE_COLUMNS.filter((c) => !present.has(c));
const missingValidation = VALIDATION_COLUMNS.filter((c) => !present.has(c));
const missing = REQUIRED.filter((c) => !present.has(c));

if (missingSetup.length > 0) {
  console.error("MISSING streaming setup profile columns:", missingSetup.join(", "));
  console.error("\nApply: npm run db:migrate -- supabase/migrations/20260705120000_streaming_setup_profiles.sql");
}

if (missingValidation.length > 0) {
  console.error("MISSING streaming validation columns:", missingValidation.join(", "));
  console.error("\nApply: npm run db:migrate -- supabase/migrations/20260707120000_streaming_destination_validation.sql");
}

if (missing.length > 0) {
  process.exit(1);
}

console.log("OK — all required streaming_destinations columns present on linked database.");
console.log(`Verified ${REQUIRED.length} columns.`);
