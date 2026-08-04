#!/usr/bin/env node
/**
 * Apply a SQL migration file to the linked Supabase project.
 * Usage: npm run db:migrate -- supabase/migrations/20260630120000_mixers_schema_sync.sql
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const fileArg = process.argv[2];
if (!fileArg) {
  console.error("Usage: npm run db:migrate -- supabase/migrations/YYYYMMDDHHMMSS_name.sql");
  process.exit(1);
}

const filePath = path.resolve(process.cwd(), fileArg);
if (!fs.existsSync(filePath)) {
  console.error("Migration file not found:", filePath);
  process.exit(1);
}

console.log("Applying migration:", filePath);
execSync(`npx supabase db query --linked -f ${JSON.stringify(filePath)}`, {
  stdio: "inherit",
});
console.log("Migration applied.");
