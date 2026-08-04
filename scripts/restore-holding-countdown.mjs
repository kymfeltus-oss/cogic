import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const HOLDING_STREAM_HOURS = 4;
const EVENT_ID = "300-awakening";

function loadEnvLocal() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local optional for CI
  }
}

function alignStartForHoldingRoom(startIso, endIso, nowMs = Date.now()) {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= nowMs) return null;
  if (startMs >= nowMs) return null;

  const proposedStartMs = endMs - HOLDING_STREAM_HOURS * 60 * 60 * 1000;
  if (proposedStartMs > nowMs) {
    return new Date(proposedStartMs).toISOString();
  }

  const fallbackMs = nowMs + 5 * 60 * 1000;
  if (fallbackMs < endMs) {
    return new Date(fallbackMs).toISOString();
  }

  return null;
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: row, error: loadError } = await supabase
  .from("event_countdown_config")
  .select("start_time,end_time")
  .eq("event_id", EVENT_ID)
  .maybeSingle();

if (loadError || !row) {
  console.error("Unable to load countdown config:", loadError?.message ?? "no row");
  process.exit(1);
}

const alignedStart = alignStartForHoldingRoom(row.start_time, row.end_time);
if (!alignedStart) {
  console.log(
    JSON.stringify({
      ok: false,
      message: "Start is already future or end is not in the future.",
      start_time: row.start_time,
      end_time: row.end_time,
    }),
  );
  process.exit(0);
}

const { data: saved, error: saveError } = await supabase
  .from("event_countdown_config")
  .update({
    start_time: alignedStart,
    updated_at: new Date().toISOString(),
  })
  .eq("event_id", EVENT_ID)
  .select("start_time,end_time")
  .single();

if (saveError || !saved) {
  console.error("Unable to save:", saveError?.message ?? "unknown");
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, ...saved }));
