#!/usr/bin/env node
/**
 * Create a new Supabase SQL migration file pair.
 * Usage: node scripts/db-migration-new.mjs add_my_column
 */
import fs from "node:fs";
import path from "node:path";

const nameArg = process.argv[2];
if (!nameArg || !/^[a-z][a-z0-9_]*$/.test(nameArg)) {
  console.error("Usage: npm run db:migration:new -- <snake_case_name>");
  console.error("Example: npm run db:migration:new -- add_mixer_notes_column");
  process.exit(1);
}

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
const base = `${stamp}_${nameArg}`;
const dir = path.join(process.cwd(), "supabase", "migrations");
const upPath = path.join(dir, `${base}.sql`);
const downPath = path.join(dir, `${base}.down.sql`);

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const upTemplate = `-- ${base}
-- Rollback: supabase/migrations/${base}.down.sql

-- TODO: your forward migration here

NOTIFY pgrst, 'reload schema';
`;

const downTemplate = `-- Rollback for ${base}.sql

-- TODO: reverse the forward migration

NOTIFY pgrst, 'reload schema';
`;

fs.writeFileSync(upPath, upTemplate, "utf8");
fs.writeFileSync(downPath, downTemplate, "utf8");

console.log(`Created:\n  ${upPath}\n  ${downPath}`);
