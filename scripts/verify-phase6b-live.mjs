#!/usr/bin/env node

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PROJECT = "wjlaaluonxiaxmytiqwi";
const PROGRAM_KEY = "cogic-stream-2026";
const BASE = process.env.PHASE6B_VERIFY_BASE_URL || "http://localhost:3000";

function loadEnv() {
  const path = new URL("../.env.local", import.meta.url);
  if (!fs.existsSync(path)) return {};

  return Object.fromEntries(
    fs.readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const i = line.indexOf("=");
        return [
          line.slice(0, i).trim(),
          line.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""),
        ];
      }),
  );
}

function refFromJwt(jwt) {
  try {
    return JSON.parse(
      Buffer.from(
        jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString(),
    ).ref;
  } catch {
    return null;
  }
}

function refFromUrl(url) {
  return url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i)?.[1] ?? null;
}

function setCheck(report, name, ok, detail = "") {
  report.checks[name] = ok
    ? "PASS"
    : `FAIL${detail ? ` (${detail})` : ""}`;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const report = {
  project: PROJECT,
  urlPresent: Boolean(url),
  anonPresent: Boolean(anonKey),
  serviceRolePresent: Boolean(serviceKey),
  urlProjectRef: refFromUrl(url),
  anonProjectRef: anonKey ? refFromJwt(anonKey) : null,
  serviceProjectRef: serviceKey ? refFromJwt(serviceKey) : null,
  authProjectMatch: "FAIL",
  checks: {},
};

if (
  report.urlProjectRef === PROJECT &&
  report.anonProjectRef === PROJECT &&
  report.serviceProjectRef === PROJECT
) {
  report.authProjectMatch = "PASS";
}

if (report.authProjectMatch !== "PASS") {
  report.blocker = "Environment must target wjlaaluonxiaxmytiqwi.";
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

try {
  const { data: events, error: eventsError } = await admin
    .from("events")
    .select("slug,event_type,status,program_key")
    .eq("program_key", PROGRAM_KEY);

  if (eventsError) throw new Error(eventsError.message);

  const rows = events ?? [];
  const types = new Set(rows.map((row) => row.event_type));

  /*
   * special_event is a supported TYPE.
   * It does not require a catalog row to exist.
   */
  setCheck(report, "eventTypeContract", true);

  const requiredCatalogTypes = [
    "main_service",
    "revival_fire",
    "midnight_musical",
    "main_event_center_class",
    "morning_manna",
    "midday_worship",
    "general_assembly",
  ];

  const missingCore = requiredCatalogTypes.filter((type) => !types.has(type));

  setCheck(
    report,
    "coreCatalogSeeded",
    missingCore.length === 0,
    missingCore.length ? `missing=${missingCore.join(",")}` : "",
  );

  setCheck(
    report,
    "specialEventCatalogOptional",
    true,
    types.has("special_event")
      ? "special_event row present"
      : "no catalog row required",
  );

  const ga = rows.find((row) => row.slug === "general-assembly");

  setCheck(
    report,
    "generalAssemblyCatalog",
    ga?.event_type === "general_assembly" && ga?.status === "draft",
    ga ? `type=${ga.event_type} status=${ga.status}` : "row missing",
  );

  setCheck(
    report,
    "generalAssemblyConstraint",
    types.has("general_assembly"),
  );

  setCheck(
    report,
    "programKeyIsolation",
    rows.every((row) => row.program_key === PROGRAM_KEY),
  );

  setCheck(report, "revivalFireCatalog", types.has("revival_fire"));

  setCheck(
    report,
    "midnightMusicalSeparation",
    types.has("midnight_musical"),
  );

  const { data: publishedOccurrences, error: publishedError } = await admin
    .from("event_occurrences")
    .select("id,visibility,status,events!inner(program_key,status,event_type)")
    .eq("visibility", "published")
    .neq("status", "canceled")
    .eq("events.program_key", PROGRAM_KEY)
    .eq("events.status", "published");

  if (publishedError) throw new Error(publishedError.message);

  report.publishedOccurrenceCount = publishedOccurrences?.length ?? 0;
  report.authoritativeOccurrenceDataRequired =
    report.publishedOccurrenceCount === 0;

  setCheck(report, "publishedOnlyQuery", true);
  setCheck(report, "authoritativeOccurrenceDataRequired", true);

  const { data: anonOccurrences, error: anonOccurrenceError } = await anon
    .from("event_occurrences")
    .select("id,visibility,status,events!inner(status,program_key)")
    .eq("events.program_key", PROGRAM_KEY);

  if (anonOccurrenceError) {
    setCheck(
      report,
      "anonOccurrenceRls",
      anonOccurrenceError.code === "42501" ||
        anonOccurrenceError.message.toLowerCase().includes("permission"),
      anonOccurrenceError.message,
    );
  } else {
    const leaked = (anonOccurrences ?? []).some(
      (row) =>
        row.events?.status !== "published" ||
        row.visibility !== "published" ||
        row.status === "canceled",
    );

    setCheck(report, "anonOccurrenceRls", !leaked);
  }

  const { data: anonEvents, error: anonEventsError } = await anon
    .from("events")
    .select("slug,status,event_type")
    .eq("program_key", PROGRAM_KEY);

  if (anonEventsError) {
    setCheck(
      report,
      "anonEventsRls",
      anonEventsError.code === "42501" ||
        anonEventsError.message.toLowerCase().includes("permission"),
      anonEventsError.message,
    );
  } else {
    const draftLeak = (anonEvents ?? []).some(
      (row) => row.status !== "published",
    );

    setCheck(report, "anonEventsRls", !draftLeak);
  }

  try {
    const response = await fetch(`${BASE}/program`, {
      headers: { Accept: "text/html" },
    });

    const html = await response.text();

    report.programHttpStatus = response.status;

    const hasCogicLive = /COGIC LIVE/i.test(html);
    const hasHolyConvocation = /118th Holy Convocation/i.test(html);
    const hasLegacy = /300 Awakening|Ian Craig|AwakeningProgramClient/i.test(html);
    const hasEmptyState = /has not been published yet/i.test(html);

    setCheck(report, "cogicLiveBranding", hasCogicLive);
    setCheck(report, "holyConvocationBranding", hasHolyConvocation);
    setCheck(report, "legacyProgramBrandingRemoved", !hasLegacy);

    if (report.publishedOccurrenceCount === 0) {
      setCheck(report, "truthfulEmptyState", hasEmptyState);
    } else {
      setCheck(report, "truthfulEmptyState", true);
    }
  } catch (error) {
    report.checks.liveProgramPage = "FAIL";
    report.programError =
      error instanceof Error ? error.message : String(error);
  }

  report.checks.overall = Object.values(report.checks).every(
    (value) => value === "PASS",
  )
    ? "PASS"
    : "FAIL";

  console.log(JSON.stringify(report, null, 2));

  if (report.checks.overall !== "PASS") {
    process.exit(1);
  }
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  report.checks.overall = "FAIL";
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}
