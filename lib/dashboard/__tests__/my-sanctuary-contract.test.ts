import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("My Sanctuary reuses the real attendee dashboard loader and cards", async () => {
  const [page, shell, desktop] = await Promise.all([
    source("app/my-sanctuary/page.tsx"),
    source("components/dashboard/DashboardShell.tsx"),
    source("components/dashboard/DesktopDashboardHome.tsx"),
  ]);
  assert.match(page, /loadAttendeeDashboard/);
  assert.match(page, /dashboardPath="\/my-sanctuary"/);
  assert.match(shell, /DesktopDashboardHome/);
  assert.match(shell, /MobileDashboardHome/);
  assert.match(desktop, /DashboardLiveStage/);
  assert.match(desktop, /TodayScheduleCard/);
  assert.match(desktop, /DASHBOARD_UTILITIES/);
  assert.match(desktop, /cl-desktop-utilities/);
});

test("My Sanctuary uses the exact banner and official seal assets", async () => {
  const [hero, topBar] = await Promise.all([
    source("components/my-sanctuary/MySanctuaryHero.tsx"),
    source("components/dashboard/DashboardTopBar.tsx"),
  ]);
  assert.match(hero, /\/my-sanctuary\/banner\.png/);
  assert.match(hero, /width=\{2172\}/);
  assert.match(hero, /height=\{724\}/);
  assert.match(topBar, /\/my-sanctuary\/cogic-live-logo-purple\.png/);
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

test("attendee desktop utilities use restrained icon+label presentation", async () => {
  const [desktop, utilities, css, registration] = await Promise.all([
    source("components/dashboard/DesktopDashboardHome.tsx"),
    source("lib/dashboard/dashboard-utilities.ts"),
    source("app/my-convocation/dashboard.css"),
    source("components/dashboard/MyConvocationCard.tsx"),
  ]);
  assert.match(desktop, /cl-desktop-utilities/);
  assert.doesNotMatch(desktop, /cl-action-grid--features|MyConvocationCard|GivingCard|AnnouncementsCard/);
  assert.match(utilities, /COGIC Travel/);
  assert.match(utilities, /Stay Informed/);
  assert.match(utilities, /COGIC Social/);
  assert.match(css, /\.cl-desktop-utilities[\s\S]*grid-template-columns/);
  assert.match(css, /\.cl-desktop-utility[\s\S]*#e9ad32/);
  assert.match(registration, /cl-reg-summary/);
  assert.match(registration, /Policy agreement pending/);
});

test("My Sanctuary hero preserves the complete intrinsic banner without overlays", async () => {
  const [hero, css] = await Promise.all([
    source("components/my-sanctuary/MySanctuaryHero.tsx"),
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
