#!/usr/bin/env node
/** Refresh PostgREST schema cache on linked Supabase. */
import { execSync } from "node:child_process";

execSync('npx supabase db query --linked "NOTIFY pgrst, \'reload schema\';"', {
  stdio: "inherit",
});
console.log("Schema cache reload notified.");
