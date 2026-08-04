#!/usr/bin/env node
/**
 * Verify public.mixers has all required columns on the linked Supabase project.
 * Usage: npm run db:verify:mixers
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REQUIRED = [
  "id",
  "tenant_id",
  "name",
  "manufacturer",
  "model",
  "connection_type",
  "ethernet_ip_address",
  "usb_device_name",
  "usb_device_id",
  "firmware_version",
  "serial_number",
  "connection_status",
  "last_connection_method",
  "last_connected_at",
  "imported_setup_json",
  "created_at",
  "updated_at",
];

const sql = `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'mixers' ORDER BY ordinal_position;`;

function logDebug(payload) {
  const logPath = path.join(process.cwd(), "debug-675ed0.log");
  try {
    fs.appendFileSync(logPath, `${JSON.stringify({ ...payload, timestamp: Date.now() })}\n`);
  } catch {
    /* ignore */
  }
}

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
const missing = REQUIRED.filter((c) => !present.has(c));

logDebug({
  sessionId: "675ed0",
  runId: "schema-verify",
  hypothesisId: "H-SCHEMA",
  location: "scripts/db-verify-mixer-schema.mjs",
  message: "mixers column verification",
  data: { present: [...present], missing, ok: missing.length === 0 },
});

if (missing.length > 0) {
  console.error("MISSING mixers columns:", missing.join(", "));
  console.error("\nApply: npm run db:migrate -- supabase/migrations/20260630120000_mixers_schema_sync.sql");
  process.exit(1);
}

console.log("OK — all required mixers columns present on linked database.");
console.log(`Verified ${REQUIRED.length} columns.`);
