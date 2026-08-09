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
  const [nav, giving, liveStage] = await Promise.all([
    source("lib/navigation/attendee-primary-nav.ts"),
    source("components/dashboard/GivingCard.tsx"),
    source("components/dashboard/DashboardLiveStage.tsx"),
  ]);
  assert.match(nav, /ATTENDEE_DASHBOARD_PATH/);
  for (const route of ["/live", "/program", "/giving", "/my-sanctuary"]) {
    assert.match(nav, new RegExp(route.replace("/", "\\/")));
  }
  assert.doesNotMatch(giving, /248,930|500,000|49%/);
  assert.match(liveStage, /href=\{isNowLive \? "\/live"/);
});

test("attendee dashboard presentation contains no legacy public brand", async () => {
  const files = [
    "components/dashboard/DashboardShell.tsx",
    "components/dashboard/DashboardTopBar.tsx",
    "components/dashboard/AttendeeDashboardHome.tsx",
  ];
  const combined = (await Promise.all(files.map(source))).join("\n");
  assert.match(combined, /COGIC/);
  assert.doesNotMatch(combined, /300 Awakening|Ian Craig|hallelujah-anyhow|ian-craig/i);
});

test("dashboard uses a transparent controls-only layer ready for full-screen media", async () => {
  const [topbar, css, controlsCss, rootShell] = await Promise.all([
    source("components/dashboard/DashboardTopBar.tsx"),
    source("app/my-convocation/dashboard.css"),
    source("components/dashboard/DashboardTopBar.module.css"),
    source("components/RootLayoutShell.tsx"),
  ]);
  assert.match(topbar, /cl-dashboard-controls/);
  assert.match(topbar, /AnnouncementBell/);
  assert.match(topbar, /cl-topbar__profile/);
  assert.doesNotMatch(topbar, /<video|header\.mp4|DashboardSearch|cogic-live-logo-purple\.png|cogic-phrase\.png|cl-topbar--video/);
  assert.doesNotMatch(topbar, /AttendeeDesktopNav|cl-topnav/);
  assert.doesNotMatch(topbar, /<span>COGIC<\/span>/);
  assert.match(controlsCss, /\.root[\s\S]*background:\s*transparent/);
  assert.match(controlsCss, /\.root[\s\S]*right:\s*\.75rem[\s\S]*left:\s*\.75rem/);
  assert.match(controlsCss, /\.tools[\s\S]*width:\s*100%[\s\S]*justify-content:\s*space-between/);
  assert.match(css, /\.cl-dash\s*\{[\s\S]*background-color:\s*#03040a/);
  assert.match(css, /\.cl-dash\s*\{[\s\S]*background-image:\s*none/);
  assert.doesNotMatch(css, /cl-sidebar|cl-topnav|cl-desktop|@media\s*\(min-width/);
  assert.match(rootShell, /!isCogicDashboard && <BrandBackdrop/);
});

test("dashboard uses one universal attendee shell without desktop XOR mount", async () => {
  const [shell, home, mobileNav, css, topBar, primaryNav] = await Promise.all([
    source("components/dashboard/DashboardShell.tsx"),
    source("components/dashboard/AttendeeDashboardHome.tsx"),
    source("components/dashboard/DashboardMobileNav.tsx"),
    source("app/my-convocation/dashboard.css"),
    source("components/dashboard/DashboardTopBar.tsx"),
    source("lib/navigation/attendee-primary-nav.ts"),
  ]);
  assert.match(shell, /AttendeeDashboardHome/);
  assert.match(shell, /DashboardMobileNav/);
  assert.match(shell, /\/my-sanctuary\/header-backgroung\.png/);
  assert.match(shell, /width=\{941\}/);
  assert.match(shell, /height=\{1672\}/);
  assert.doesNotMatch(shell, /<video|\.mp4|dashboard-welcome-background\.png/);
  assert.doesNotMatch(shell, /\bhero\b|DashboardHero|MySanctuaryHero/);
  assert.doesNotMatch(shell, /useDesktopDashboard|DesktopDashboardHome|MobileDashboardHome|isDesktop/);
  assert.doesNotMatch(css, /\.cl-dashboard-desktop\s*\{\s*display:\s*none/);
  assert.doesNotMatch(css, /\.cl-mobile-home\s*\{\s*display:\s*none/);
  assert.match(home, /DashboardLiveStage/);
  assert.match(home, /DASHBOARD_UTILITIES/);
  assert.match(home, /StayConnectedPrompt/);
  assert.match(home, /TicketStoreClient/);
  assert.match(home, /HousingExperience/);
  assert.doesNotMatch(home, /DashboardHero|MySanctuaryHero|\/my-sanctuary\/banner\.png/);
  assert.doesNotMatch(topBar, /cogic-seal\.png|cl-topbar__account-copy|ChevronDown|AttendeeDesktopNav/);
  for (const label of ["Home", "Watch Live", "Program", "My Sanctuary", "Give"]) {
    assert.match(primaryNav, new RegExp(label));
    assert.match(mobileNav, /ATTENDEE_PRIMARY_NAV/);
  }
  assert.match(css, /\.cl-bottom-nav[\s\S]*position:\s*fixed/);
  assert.match(css, /--cl-mobile-shell-max:\s*430px/);
  assert.match(css, /\.cl-dash\s*\{[\s\S]*width:\s*min\(100%,\s*var\(--cl-mobile-shell-max\)\)/);
  assert.match(css, /\.cl-bottom-nav\s*\{[\s\S]*left:\s*50%[\s\S]*transform:\s*translateX\(-50%\)/);
  assert.doesNotMatch(css, /\.cl-bottom-nav\s*\{\s*display:\s*none\s*!important/);
  assert.match(css, /--cl-mobile-feature-aspect:\s*2160\s*\/\s*1280/);
  assert.match(css, /\.cl-dashboard-media[\s\S]*aspect-ratio:\s*9\s*\/\s*16/);
  assert.match(css, /\.cl-dashboard-media img[\s\S]*object-fit:\s*contain/);
  assert.match(css, /\.cl-mobile-home[\s\S]*padding:\s*clamp\(20rem,\s*84vw,\s*23rem\)/);
  assert.doesNotMatch(css, /cl-hero|my-sanctuary-hero/);
});
