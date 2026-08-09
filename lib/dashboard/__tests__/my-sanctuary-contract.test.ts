import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("My Sanctuary reuses the real attendee dashboard loader and universal home", async () => {
  const [page, shell, home] = await Promise.all([
    source("app/my-sanctuary/page.tsx"),
    source("components/dashboard/DashboardShell.tsx"),
    source("components/dashboard/AttendeeDashboardHome.tsx"),
  ]);
  assert.match(page, /loadAttendeeDashboard/);
  assert.match(page, /dashboardPath="\/my-sanctuary"/);
  assert.match(shell, /AttendeeDashboardHome/);
  assert.doesNotMatch(shell, /DesktopDashboardHome|MobileDashboardHome|useDesktopDashboard/);
  assert.match(home, /DashboardLiveStage/);
  assert.match(home, /DASHBOARD_UTILITIES/);
  assert.match(home, /StayConnectedPrompt/);
});

test("My Sanctuary uses the exact banner and a controls-only dashboard layer", async () => {
  const [hero, topBar] = await Promise.all([
    source("components/my-sanctuary/MySanctuaryHero.tsx"),
    source("components/dashboard/DashboardTopBar.tsx"),
  ]);
  assert.match(hero, /\/my-sanctuary\/banner\.png/);
  assert.match(hero, /width=\{2160\}/);
  assert.match(hero, /height=\{1280\}/);
  assert.match(topBar, /cl-dashboard-controls/);
  assert.doesNotMatch(topBar, /<video|header\.mp4|cogic-live-logo-purple\.png|cogic-phrase\.png|DashboardSearch/);
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

test("attendee universal utilities use restrained icon+label presentation", async () => {
  const [home, utilities, css, registration] = await Promise.all([
    source("components/dashboard/AttendeeDashboardHome.tsx"),
    source("lib/dashboard/dashboard-utilities.ts"),
    source("app/my-convocation/dashboard.css"),
    source("components/dashboard/MyConvocationCard.tsx"),
  ]);
  assert.match(home, /cl-mobile-utilities/);
  assert.doesNotMatch(home, /cl-action-grid--features|cl-desktop-utilities|MyConvocationCard|GivingCard|AnnouncementsCard/);
  assert.match(utilities, /COGIC Travel/);
  assert.match(utilities, /Stay Informed/);
  assert.match(utilities, /COGIC Social/);
  assert.match(css, /\.cl-mobile-utilities[\s\S]*grid-template-columns/);
  assert.match(registration, /cl-reg-summary/);
  assert.match(registration, /Policy agreement pending/);
});

test("My Sanctuary hero preserves the complete intrinsic banner without overlays", async () => {
  const [hero, css] = await Promise.all([
    source("components/my-sanctuary/MySanctuaryHero.tsx"),
    source("app/my-convocation/dashboard.css"),
  ]);
  assert.match(hero, /\/my-sanctuary\/banner\.png/);
  assert.match(hero, /width=\{2160\}/);
  assert.match(hero, /height=\{1280\}/);
  assert.doesNotMatch(hero, /<h1|Empowered to Serve|convocation-hero__copy/);
  assert.match(css, /\.cl-dash \.cl-mobile-home \.my-sanctuary-hero img[\s\S]*width:\s*100%[\s\S]*height:\s*auto/);
  assert.match(css, /object-fit:\s*contain/);
  assert.doesNotMatch(css, /\.my-sanctuary-hero img[^}]*object-fit:\s*cover/);
  assert.match(css, /--dash-banner-max-h:\s*none/);
  assert.doesNotMatch(css, /@media\s*\((?:min|max)-width|cl-desktop|cl-dashboard-desktop/);
});
