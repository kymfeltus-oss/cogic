import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("dashboard is wired to the canonical attendee route and real loaders", async () => {
  const [page, loader] = await Promise.all([
    source("app/my-convocation/page.tsx"),
    source("lib/dashboard/load-attendee-dashboard.ts"),
  ]);
  assert.match(page, /loadAttendeeDashboard/);
  assert.match(loader, /getPublishedOccurrences/);
  assert.match(loader, /fetchManifestStreamConfig/);
  assert.match(loader, /getRegistrationForUser/);
  assert.match(loader, /registration_credentials/);
});

test("dashboard cards use real routes and omit fake aggregate metrics", async () => {
  const [sidebar, giving, watch] = await Promise.all([
    source("components/dashboard/DashboardSidebar.tsx"),
    source("components/dashboard/GivingCard.tsx"),
    source("components/dashboard/WatchLiveCard.tsx"),
  ]);
  for (const route of ["/my-convocation", "/live", "/program", "/register", "/giving", "/replays"]) {
    assert.match(sidebar, new RegExp(route.replace("/", "\\/")));
  }
  assert.doesNotMatch(giving, /248,930|500,000|49%/);
  assert.doesNotMatch(watch, /Bishop J\.|Official Day Service/);
});

test("attendee dashboard presentation contains no legacy public brand", async () => {
  const files = [
    "components/dashboard/DashboardShell.tsx",
    "components/dashboard/DashboardSidebar.tsx",
    "components/dashboard/DashboardTopBar.tsx",
    "components/dashboard/ConvocationHero.tsx",
  ];
  const combined = (await Promise.all(files.map(source))).join("\n");
  assert.match(combined, /COGIC/);
  assert.doesNotMatch(combined, /Vital Organs|300 Awakening|Ian Craig/);
});
