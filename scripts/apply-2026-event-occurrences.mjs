#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const programKey = "cogic-stream-2026";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const fail = (label, error) => { if (error) throw new Error(`${label}: ${error.message}`); };
const dates = ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"];
const services = [
  { slug: "morning-manna", localTime: "09:30:00", offset: "-06:00" },
  { slug: "midday-worship", localTime: "11:00:00", offset: "-06:00" },
  { slug: "evening-worship", localTime: "19:00:00", offset: "-06:00" },
];

const { data: events, error: eventError } = await db.from("events").select("id,slug,event_type").eq("program_key", programKey);
fail("load events", eventError);
const bySlug = Object.fromEntries(events.map((event) => [event.slug, event]));
for (const slug of [...services.map((service) => service.slug), "revival-fire", "midnight-musical", "general-assembly"]) {
  if (!bySlug[slug]) throw new Error(`Required event definition missing: ${slug}`);
}

await Promise.all(["morning-manna", "midday-worship", "evening-worship", "revival-fire"].map(async (slug) => {
  const { error } = await db.from("events").update({ status: "published" }).eq("id", bySlug[slug].id);
  fail(`publish ${slug}`, error);
}));

for (const date of dates) for (const service of services) {
  const scheduledStart = `${date}T${service.localTime}${service.offset}`;
  const { data: existing, error: lookupError } = await db.from("event_occurrences").select("id").eq("event_id", bySlug[service.slug].id).eq("local_date", date).maybeSingle();
  fail(`lookup ${service.slug}/${date}`, lookupError);
  const row = { event_id: bySlug[service.slug].id, local_date: date, timezone: "America/Chicago", scheduled_start_at: scheduledStart, scheduled_end_at: null, estimated_start_at: null, follows_occurrence_id: null, start_mode: "fixed", status: "scheduled", visibility: "published" };
  const result = existing ? await db.from("event_occurrences").update(row).eq("id", existing.id) : await db.from("event_occurrences").insert(row);
  fail(`write ${service.slug}/${date}`, result.error);
}

const { data: worship, error: worshipError } = await db.from("event_occurrences").select("id,event_id,local_date,events!inner(slug,program_key)").eq("events.program_key", programKey).in("events.slug", services.map((service) => service.slug)).in("local_date", dates);
fail("load worship occurrences", worshipError);
for (const evening of worship.filter((row) => row.events.slug === "evening-worship")) {
  const { data: existing, error: lookupError } = await db.from("event_occurrences").select("id").eq("event_id", bySlug["revival-fire"].id).eq("local_date", evening.local_date).maybeSingle();
  fail(`lookup revival-fire/${evening.local_date}`, lookupError);
  const row = { event_id: bySlug["revival-fire"].id, local_date: evening.local_date, timezone: "America/Chicago", scheduled_start_at: null, scheduled_end_at: null, estimated_start_at: null, follows_occurrence_id: evening.id, start_mode: "after_predecessor", status: "scheduled", visibility: "published" };
  const result = existing ? await db.from("event_occurrences").update(row).eq("id", existing.id) : await db.from("event_occurrences").insert(row);
  fail(`write revival-fire/${evening.local_date}`, result.error);
}

const accessKeys = ["CONVOCATION_SERVICE_ACCESS_2026", "GENERAL_SEATING_2026", "PREFERRED_SEATING_2026", "JUNIOR_GUARDIAN_SERVICE_ACCESS_2026", "JUNIOR_GUARDIAN_SEATING_2026"];
const { error: activateError } = await db.from("access_entitlements").update({ active: true }).eq("program_key", programKey).in("entitlement_key", accessKeys);
fail("activate worship entitlements", activateError);
const { error: juniorZoneError } = await db.from("access_entitlements").update({ access_zone: "PREFERRED_SEATING" }).eq("program_key", programKey).eq("entitlement_key", "JUNIOR_GUARDIAN_SEATING_2026");
fail("scope junior seating", juniorZoneError);

const { data: zones, error: zoneError } = await db.from("access_zones").select("id,zone_key").eq("program_key", programKey).in("zone_key", ["GENERAL_ENTRY", "PREFERRED_SEATING"]);
fail("load zones", zoneError);
for (const occurrence of worship) for (const zone of zones) {
  const { error } = await db.from("occurrence_access_rules").upsert({ event_occurrence_id: occurrence.id, access_zone_id: zone.id, entitlement_id: null, access_mode: "REGISTRATION", usage_mode: "REENTRY_ALLOWED", allow_general_fallback: zone.zone_key === "PREFERRED_SEATING", active: true }, { onConflict: "event_occurrence_id,access_zone_id" });
  fail(`map ${occurrence.id}/${zone.zone_key}`, error);
}

console.log(JSON.stringify({ exactWorshipOccurrences: worship.length, linkedAfterRevivalFireOccurrences: dates.length, accessRules: worship.length * zones.length, timezone: "America/Chicago", fabricatedTimes: 0, midnightMusicalOccurrence: "BLOCKED", generalAssemblyOccurrences: "BLOCKED", musicalAccessRules: 0 }, null, 2));
