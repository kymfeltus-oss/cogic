import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("My Sanctuary reuses the real attendee dashboard loader and cards", async () => {
  const [page, shell] = await Promise.all([
    source("app/my-sanctuary/page.tsx"),
    source("components/dashboard/DashboardShell.tsx"),
  ]);
  assert.match(page, /loadAttendeeDashboard/);
  assert.match(page, /dashboardPath="\/my-sanctuary"/);
  assert.match(shell, /WatchLiveCard/);
  assert.match(shell, /TodayScheduleCard/);
  assert.match(shell, /GivingCard/);
  assert.match(shell, /MyConvocationCard/);
});

test("My Sanctuary uses the exact banner and official seal assets", async () => {
  const [hero, topBar] = await Promise.all([
    source("components/my-sanctuary/MySanctuaryHero.tsx"),
    source("components/dashboard/DashboardTopBar.tsx"),
  ]);
  assert.match(hero, /\/my-sanctuary\/banner\.png/);
  assert.match(hero, /width=\{2172\}/);
  assert.match(hero, /height=\{724\}/);
  assert.match(topBar, /\/branding\/cogic-seal\.png/);
  assert.doesNotMatch(topBar, />C<\/span>/);
});

test("My Sanctuary is protected and isolated from the legacy global dock", async () => {
  const [routing, proxy, rootShell] = await Promise.all([
    source("lib/auth/routing.ts"),
    source("proxy.ts"),
    source("components/RootLayoutShell.tsx"),
  ]);
  assert.match(routing, /"\/my-sanctuary"/);
  assert.match(proxy, /"\/my-sanctuary"/);
  assert.match(rootShell, /pathname === "\/my-sanctuary"/);
});

test("dashboard hero preserves the complete intrinsic banner without overlays", async () => {
  const [hero, css] = await Promise.all([
    source("components/dashboard/ConvocationHero.tsx"),
    source("app/my-convocation/dashboard.css"),
  ]);
  assert.match(hero, /\/my-sanctuary\/banner\.png/);
  assert.match(hero, /width=\{2172\}/);
  assert.match(hero, /height=\{724\}/);
  assert.doesNotMatch(hero, /<h1|Empowered to Serve|convocation-hero__copy/);
  assert.match(css, /\.convocation-hero__artwork img[^}]*width:\s*100%[^}]*height:\s*auto/);
  assert.match(css, /object-fit:\s*contain/);
  assert.doesNotMatch(css, /\.convocation-hero__artwork img[^}]*object-fit:\s*cover/);
  assert.match(css, /--dash-banner-max-h:\s*none/);
  assert.match(css, /\.convocation-hero__artwork img[^}]*max-height:\s*var\(--dash-banner-max-h\)/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /@media \(max-width: 1180px\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
});
