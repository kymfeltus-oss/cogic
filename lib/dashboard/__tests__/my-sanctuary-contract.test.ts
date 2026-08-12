import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("My Sanctuary reuses the real attendee dashboard loader and universal portrait shell", async () => {
  const [page, shell, home] = await Promise.all([
    source("app/my-sanctuary/page.tsx"),
    source("components/dashboard/DashboardShell.tsx"),
    source("components/dashboard/AttendeeDashboardHome.tsx"),
  ]);
  assert.match(page, /loadAttendeeDashboard/);
  assert.match(page, /dashboardPath="\/my-sanctuary"/);
  assert.match(page, /DashboardLoading/);
  assert.match(shell, /AttendeeDashboardHome/);
  assert.match(shell, /src="\/my-sanctuary\/header-backgroung\.png(?:\?[^"]*)?"/);
  assert.doesNotMatch(shell, /bishops-hc-2026-final\.png/);
  assert.doesNotMatch(shell, /<video|mobile_dashboard\.mp4/);
  assert.doesNotMatch(shell, /DesktopDashboardHome|MobileDashboardHome|useDesktopDashboard/);
  assert.doesNotMatch(page, /MySanctuaryHero|my-sanctuary\.css/);
  assert.match(home, /DashboardLiveStage/);
  assert.match(home, /DASHBOARD_UTILITIES/);
  assert.match(home, /StayConnectedPrompt/);
  assert.doesNotMatch(home, /MyConvocationCard/);
});

test("My Sanctuary uses the integrated portrait artwork and controls-only dashboard layer", async () => {
  const [page, shell, topBar] = await Promise.all([
    source("app/my-sanctuary/page.tsx"),
    source("components/dashboard/DashboardShell.tsx"),
    source("components/dashboard/DashboardTopBar.tsx"),
  ]);
  assert.doesNotMatch(page, /banner\.png|MySanctuaryHero/);
  assert.match(shell, /src="\/my-sanctuary\/header-backgroung\.png(?:\?[^"]*)?"/);
  assert.doesNotMatch(shell, /bishops-hc-2026-final\.png/);
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

test("attendee universal utilities use approved feature suite presentation", async () => {
  const [home, utilities, css, registration] = await Promise.all([
    source("components/dashboard/AttendeeDashboardHome.tsx"),
    source("lib/dashboard/dashboard-utilities.ts"),
    source("app/my-convocation/dashboard.css"),
    source("components/dashboard/MyConvocationCard.tsx"),
  ]);
  assert.match(home, /cl-dashboard-feature-suite/);
  assert.doesNotMatch(home, /MyConvocationCard/);
  assert.doesNotMatch(home, /cl-action-grid--features|cl-desktop-utilities|GivingCard|AnnouncementsCard/);
  assert.match(utilities, /My Registration/);
  assert.match(utilities, /href:\s*"\/my-convocation\/registration"/);
  assert.match(utilities, /COGIC Travel/);
  assert.match(utilities, /Stay Informed/);
  assert.match(utilities, /COGIC Connect/);
  assert.match(utilities, /href:\s*"\/social"/);
  assert.match(css, /\.cl-dashboard-feature-suite|\.cl-dashboard-feature-card/);
  assert.match(registration, /cl-reg-summary/);
  assert.match(registration, /Policy agreement pending/);
  assert.match(registration, /\/my-convocation\/registration|My Registration/);
});

test("My Sanctuary contains no superseded standalone dashboard banner", async () => {
  const [page, shell, home, css] = await Promise.all([
    source("app/my-sanctuary/page.tsx"),
    source("components/dashboard/DashboardShell.tsx"),
    source("components/dashboard/AttendeeDashboardHome.tsx"),
    source("app/my-convocation/dashboard.css"),
  ]);
  const combined = `${page}\n${shell}\n${home}\n${css}`;
  assert.doesNotMatch(combined, /DashboardHero|MySanctuaryHero|cl-hero|my-sanctuary-hero/);
  assert.doesNotMatch(combined, /\/my-sanctuary\/banner\.png/);
  assert.match(css, /\.cl-dashboard-media__artwork[\s\S]*object-fit:\s*contain/);
  assert.doesNotMatch(css, /@media\s*\((?:min|max)-width|cl-desktop|cl-dashboard-desktop/);
});
