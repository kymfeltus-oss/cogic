#!/usr/bin/env node
/**
 * Lightweight parity checklist for managed features.
 * Flags feature definitions missing admin route, attendee route, or API persistence.
 * Not a brittle generic AST parser — explicit known feature contracts only.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const FEATURES = [
  {
    name: "Registration Slice 2",
    adminRoute: "app/owner/registrations/page.tsx",
    attendeeRoute: "app/register/page.tsx",
    apis: [
      "app/api/owner/registrations/route.ts",
      "app/api/registration/experience/route.ts",
      "app/api/registration/checkout/route.ts",
    ],
    permissionMarkers: ["requireOwnerUser", "getUserFromSession"],
  },
  {
    name: "Announcements / Updates",
    adminRoute: "app/owner/announcements/page.tsx",
    attendeeRoute: "app/updates/page.tsx",
    apis: [
      "app/api/owner/announcements/route.ts",
      "app/api/announcements/route.ts",
      "app/api/announcements/unread/route.ts",
    ],
    permissionMarkers: ["requireOwnerUser", "getUserFromSession"],
  },
  {
    name: "Manual video upload / Replays",
    adminRoute: "app/owner/replays/page.tsx",
    attendeeRoute: "app/replays/page.tsx",
    apis: [
      "app/api/owner/media/upload-session/route.ts",
      "app/api/owner/media/upload-complete/route.ts",
      "app/api/owner/replays/route.ts",
    ],
    permissionMarkers: ["requireOwnerUser", "createSignedUploadUrl"],
  },
  {
    name: "Device push notifications",
    adminRoute: "app/owner/announcements/page.tsx",
    attendeeRoute: "app/updates/page.tsx",
    apis: [
      "app/api/push/subscribe/route.ts",
      "app/api/push/preferences/route.ts",
      "app/api/owner/announcements/route.ts",
      "app/api/owner/push/status/route.ts",
    ],
    permissionMarkers: ["requireOwnerUser", "getUserFromSession", "sendAnnouncementPush"],
  },
  {
    name: "Schedule reminders",
    adminRoute: "app/owner/announcements/page.tsx",
    attendeeRoute: "app/program/page.tsx",
    apis: [
      "app/api/reminders/route.ts",
      "app/api/cron/process-reminders/route.ts",
      "app/api/owner/push/status/route.ts",
    ],
    permissionMarkers: ["getUserFromSession", "CRON_SECRET", "processDueScheduleReminders"],
  },
];

let failed = 0;

for (const feature of FEATURES) {
  const missing = [];
  for (const relative of [feature.adminRoute, feature.attendeeRoute, ...feature.apis]) {
    if (!fs.existsSync(path.join(root, relative))) missing.push(relative);
  }
  const combined = feature.apis
    .map((relative) => fs.readFileSync(path.join(root, relative), "utf8"))
    .join("\n");
  for (const marker of feature.permissionMarkers) {
    if (!combined.includes(marker)) missing.push(`permission:${marker}`);
  }
  if (missing.length) {
    failed += 1;
    console.error(`FAIL ${feature.name}`);
    for (const item of missing) console.error(`  missing ${item}`);
  } else {
    console.log(`PASS ${feature.name}`);
  }
}

const standard = fs.readFileSync(
  path.join(root, "docs/IMPLEMENTATION_STANDARD.md"),
  "utf8",
);
if (!standard.includes("ADMIN / USER PARITY RULE")) {
  failed += 1;
  console.error("FAIL implementation standard missing ADMIN / USER PARITY RULE");
} else {
  console.log("PASS implementation standard parity rule");
}

if (failed > 0) {
  process.exit(1);
}
console.log("Admin/user parity checklist OK.");
