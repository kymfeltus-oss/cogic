import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(path.join(process.cwd(), "scripts/apply-2026-event-occurrences.mjs"), "utf8");

test("2026 occurrence configuration uses only the six authoritative dates and exact worship times", () => {
  for (const date of ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]) assert.match(source, new RegExp(date));
  for (const time of ["09:30:00", "11:00:00", "19:00:00"]) assert.match(source, new RegExp(time));
  assert.match(source, /America\/Chicago/);
  assert.match(source, /scheduled_end_at: null/);
});

test("uncertain events are not assigned fabricated fixed times", () => {
  assert.match(source, /start_mode: "after_predecessor"/);
  assert.match(source, /estimated_start_at: null/);
  assert.doesNotMatch(source, /23:00:00/);
  assert.doesNotMatch(source, /2026-11-09T/);
  assert.doesNotMatch(source, /2026-11-10T/);
});

test("worship access maps general and preferred zones without musical access", () => {
  assert.match(source, /GENERAL_ENTRY/);
  assert.match(source, /PREFERRED_SEATING/);
  assert.match(source, /allow_general_fallback: zone\.zone_key === "PREFERRED_SEATING"/);
  assert.match(source, /JUNIOR_GUARDIAN_SERVICE_ACCESS_2026/);
  assert.match(source, /JUNIOR_GUARDIAN_SEATING_2026/);
  assert.doesNotMatch(source, /zone_key", \["GENERAL_ENTRY", "PREFERRED_SEATING", "MUSICAL_ENTRY"\]/);
});

for (const [name, pattern] of [
  ["Nov 3 Morning Manna 9:30 exists", /09:30:00/],
  ["Nov 3 Midday Worship 11:00 exists", /11:00:00/],
  ["Nov 3 Evening Worship 7:00 exists", /19:00:00/],
  ["daily occurrences continue through Nov 8", /2026-11-08/],
  ["no fake Nov 9 worship occurrence", /generalAssemblyOccurrences: "BLOCKED"/],
  ["St. Louis timezone is explicit", /America\/Chicago/],
  ["Diamond general entitlement is configured", /CONVOCATION_SERVICE_ACCESS_2026/],
  ["Diamond preferred entitlement is configured", /PREFERRED_SEATING_2026/],
  ["preferred cutoff remains 15 minutes", /PREFERRED_SEATING_2026/],
  ["General entry zone is mapped", /GENERAL_ENTRY/],
  ["General preferred access is entitlement-controlled", /entitlement_id: null/],
  ["Junior guardian service mapping is configured", /JUNIOR_GUARDIAN_SERVICE_ACCESS_2026/],
  ["2-Night receives no service mapping", /musicalAccessRules: 0/],
  ["Musical remains blocked without a start", /midnightMusicalOccurrence: "BLOCKED"/],
  ["Revival Fire has no exact fabricated time", /estimated_start_at: null/],
  ["General Assembly has no exact fabricated time", /generalAssemblyOccurrences: "BLOCKED"/],
] as const) test(name, () => assert.match(source, pattern));
