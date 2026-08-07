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
  const [nav, giving, watch] = await Promise.all([
    source("lib/navigation/attendee-desktop-nav.ts"),
    source("components/dashboard/GivingCard.tsx"),
    source("components/dashboard/WatchLiveCard.tsx"),
  ]);
  for (const route of ["/my-convocation", "/live", "/program", "/register", "/giving", "/replays"]) {
    assert.match(nav, new RegExp(route.replace("/", "\\/")));
  }
  assert.doesNotMatch(giving, /248,930|500,000|49%/);
  assert.doesNotMatch(watch, /Bishop J\.|Official Day Service/);
});

test("attendee dashboard presentation contains no legacy public brand", async () => {
  const files = [
    "components/dashboard/DashboardShell.tsx",
    "components/dashboard/DashboardTopBar.tsx",
    "components/navigation/AttendeeDesktopNav.tsx",
    "components/dashboard/ConvocationHero.tsx",
  ];
  const combined = (await Promise.all(files.map(source))).join("\n");
  assert.match(combined, /COGIC/);
  assert.doesNotMatch(combined, /300 Awakening|Ian Craig/);
});

test("dashboard top bar uses the COGIC LIVE PNG logo asset", async () => {
  const [topbar, css] = await Promise.all([
    source("components/dashboard/DashboardTopBar.tsx"),
    source("app/my-convocation/dashboard.css"),
  ]);
  assert.match(topbar, /\/my-sanctuary\/cogic-live-logo-purple\.png/);
  assert.doesNotMatch(topbar, /<span>COGIC<\/span>/);
  assert.doesNotMatch(topbar, /<Play[\s/>]/);
  assert.match(css, /\.cl-topbar__logo[^}]*object-fit:\s*contain/);
  const logoPath = path.join(root, "public", "my-sanctuary", "cogic-live-logo-purple.png");
  assert.equal((await readFile(logoPath)).byteLength > 0, true);
});

test("dashboard uses a mobile-first streaming shell with safe fixed navigation", async () => {
  const [shell, hero, mobileNav, css] = await Promise.all([
    source("components/dashboard/DashboardShell.tsx"),
    source("components/dashboard/DashboardHero.tsx"),
    source("components/dashboard/DashboardMobileNav.tsx"),
    source("app/my-convocation/dashboard.css"),
  ]);
  assert.match(shell, /DashboardHero/);
  assert.match(shell, /DashboardLiveStage/);
  assert.doesNotMatch(shell, /DashboardSidebar/);
  assert.match(hero, /width=\{2172\}/);
  assert.match(hero, /height=\{724\}/);
  assert.doesNotMatch(hero, /\bfill\b/);
  for (const label of ["Home", "Watch Live", "Program", "My Sanctuary", "Give"]) {
    assert.match(mobileNav, new RegExp(label));
  }
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /\.cl-bottom-nav[\s\S]*position:\s*fixed/);
  assert.match(css, /\.cl-hero__image[^}]*object-fit:\s*contain/);
});
