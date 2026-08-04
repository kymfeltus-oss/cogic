#!/usr/bin/env node
/**
 * Verify where Custom RTMP / Restream credentials are stored (Supabase vs .env).
 * Usage: node scripts/verify-restream-credentials.mjs
 * Does not print full stream keys — masked suffix only.
 */
import { createDecipheriv, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TENANT_ID = "300-awakening";

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
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
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

function maskKey(key) {
  if (!key?.trim()) return null;
  const k = key.trim();
  if (k.length <= 8) return "••••";
  return `••••${k.slice(-6)}`;
}

function decryptSecret(payload) {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted payload.");
  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  const key = raw
    ? createHash("sha256").update(raw).digest()
    : createHash("sha256").update("dev-token-encryption-key").digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function decryptOptional(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    return decryptSecret(value);
  } catch {
    return null;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const envUrl = process.env.CUSTOM_RTMP_URL?.trim() || null;
const envKey = process.env.CUSTOM_RTMP_STREAM_KEY?.trim() || null;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: services, error: svcErr } = await supabase
  .from("services")
  .select("id, service_date, active_stream_method")
  .eq("tenant_id", TENANT_ID)
  .order("service_date", { ascending: false })
  .limit(3);

if (svcErr) {
  console.error("services query failed:", svcErr.message);
  process.exit(1);
}

console.log("=== Restream credential storage audit ===\n");
console.log(".env.local:");
console.log(`  CUSTOM_RTMP_URL: ${envUrl ?? "(not set)"}`);
console.log(`  CUSTOM_RTMP_STREAM_KEY: ${envKey ? maskKey(envKey) : "(not set)"}`);

if (!services?.length) {
  console.log("\nNo services rows for tenant", TENANT_ID);
  process.exit(0);
}

for (const service of services) {
  console.log(`\n--- Service ${service.id} (${service.service_date}) active=${service.active_stream_method ?? "—"} ---`);

  const { data: destinations, error: destErr } = await supabase
    .from("streaming_destinations")
    .select("id, platform, destination_name, stream_url_encrypted, stream_key_encrypted, connection_status, selected_for_today")
    .eq("service_id", service.id);

  if (destErr) {
    console.log("  streaming_destinations error:", destErr.message);
    continue;
  }

  const custom = (destinations ?? []).filter((d) => String(d.platform).toLowerCase().includes("custom"));
  if (!custom.length) {
    console.log("  No custom_rtmp streaming_destinations row.");
  } else {
    for (const row of custom) {
      const streamUrl = decryptOptional(row.stream_url_encrypted);
      const streamKey = decryptOptional(row.stream_key_encrypted);
      const matchesEnv =
        envKey && streamKey ? streamKey.trim() === envKey.trim() : false;
      console.log(`  destination id=${row.id} name=${row.destination_name}`);
      console.log(`    stream_url: ${streamUrl ?? "(empty)"}`);
      console.log(`    stream_key: ${streamKey ? maskKey(streamKey) : "(empty)"}`);
      console.log(`    matches .env CUSTOM_RTMP_STREAM_KEY: ${matchesEnv ? "yes" : streamKey ? "no (different key in DB)" : "n/a"}`);
      console.log(`    status=${row.connection_status} selected_for_today=${row.selected_for_today}`);
    }
  }

  const { data: presets, error: presetErr } = await supabase
    .from("stream_output_presets")
    .select("id, method, rtmp_url, encrypted_stream_key")
    .eq("tenant_id", TENANT_ID)
    .eq("service_id", service.id);

  if (presetErr) {
    const lower = presetErr.message.toLowerCase();
    if (lower.includes("does not exist") || lower.includes("could not find")) {
      console.log("  stream_output_presets table not present (skipped).");
    } else {
      console.log("  stream_output_presets error:", presetErr.message);
    }
    continue;
  }

  const rtmpPresets = (presets ?? []).filter((p) =>
    ["custom_rtmp", "obs_vmix"].includes(String(p.method)),
  );
  if (!rtmpPresets.length) {
    console.log("  No custom_rtmp/obs_vmix stream_output_presets rows.");
  } else {
    for (const row of rtmpPresets) {
      const presetKey = decryptOptional(row.encrypted_stream_key);
      const matchesEnv = envKey && presetKey ? presetKey.trim() === envKey.trim() : false;
      console.log(`  preset method=${row.method} id=${row.id}`);
      console.log(`    rtmp_url: ${row.rtmp_url ?? "(empty)"}`);
      console.log(`    stream_key: ${presetKey ? maskKey(presetKey) : "(empty)"}`);
      console.log(`    matches .env: ${matchesEnv ? "yes" : presetKey ? "no" : "n/a"}`);
    }
  }
}

console.log("\n=== Go-live resolution order (custom_rtmp) ===");
console.log("1. stream_output_presets.encrypted_stream_key (if row exists)");
console.log("2. streaming_destinations.stream_key_encrypted");
console.log("3. .env.local CUSTOM_RTMP_STREAM_KEY (fallback)");
console.log("\nReveal API reports source: preset | destination | env");
