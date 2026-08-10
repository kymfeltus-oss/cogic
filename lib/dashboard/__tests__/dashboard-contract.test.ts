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
  assert.match(page, /DashboardLoading/);
  assert.match(loader, /getPublishedOccurrences/);
  assert.match(loader, /fetchManifestStreamConfig/);
  assert.match(loader, /getRegistrationForUser/);
  assert.match(loader, /registration_credentials/);
  assert.match(loader, /loadDashboardTicketsSummary/);
  assert.match(loader, /loadDashboardHousingSummary/);
});

test("dashboard cards use real routes and omit fake aggregate metrics", async () => {
  const [nav, giving, liveStage, utilities] = await Promise.all([
    source("lib/navigation/attendee-primary-nav.ts"),
    source("components/giving/CogicGivingExperience.tsx"),
    source("components/dashboard/DashboardLiveStage.tsx"),
    source("lib/dashboard/dashboard-utilities.ts"),
  ]);
  assert.match(nav, /ATTENDEE_DASHBOARD_PATH/);
  for (const route of ["/register", "/live", "/giving", "/travel"]) {
    assert.match(nav, new RegExp(route.replace("/", "\\/")));
  }
  assert.doesNotMatch(giving, /248,930|500,000|49%/);
  assert.match(liveStage, /href=\{isNowLive \? "\/live"/);
  assert.doesNotMatch(liveStage, /resolveAttendeeMediaState\([^)]*,\s*true\)/);
  assert.match(utilities, /href:\s*"\/social"/);
  assert.doesNotMatch(utilities, /\/experience\/live/);
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
  assert.match(topbar, /cl-topbar__name/);
  assert.doesNotMatch(topbar, /<video|header\.mp4|DashboardSearch|cogic-live-logo-purple\.png|cogic-phrase\.png|cl-topbar--video/);
  assert.doesNotMatch(topbar, /AttendeeDesktopNav|cl-topnav/);
  assert.doesNotMatch(topbar, /<span>COGIC<\/span>/);
  assert.match(controlsCss, /\.root[\s\S]*background:\s*transparent/);
  assert.match(controlsCss, /\.root[\s\S]*right:\s*\.75rem[\s\S]*left:\s*\.75rem/);
  assert.match(controlsCss, /\.tools[\s\S]*position:\s*relative[\s\S]*justify-content:\s*flex-end/);
  assert.match(controlsCss, /cl-topbar__account[\s\S]*right:\s*3\.45rem/);
  assert.match(controlsCss, /cl-topbar__profile[\s\S]*margin:\s*0[\s\S]*padding:\s*0/);
  assert.match(controlsCss, /cl-topbar__name[\s\S]*text-overflow:\s*ellipsis/);
  assert.match(controlsCss, /cl-topbar__avatar[\s\S]*align-items:\s*center[\s\S]*justify-content:\s*center/);
  assert.doesNotMatch(controlsCss, /content:\s*"Alerts"/);
  assert.match(css, /\.cl-dash\s*\{[\s\S]*background-color:\s*#03040a/);
  assert.match(css, /\.cl-dash\s*\{[\s\S]*background-image:\s*none/);
  assert.doesNotMatch(css, /cl-sidebar|cl-topnav|cl-desktop|@media\s*\(min-width/);
  assert.match(rootShell, /!isCogicDashboard && !isTravelShell && <BrandBackdrop/);
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
  assert.match(shell, /src="\/my-sanctuary\/header-backgroung\.png"/);
  assert.match(shell, /src="\/my-sanctuary\/bishops-hc-2026-final\.png"/);
  assert.doesNotMatch(shell, /<video|mobile_dashboard\.mp4/);
  assert.doesNotMatch(shell, /dashboard-welcome-background\.png/);
  assert.doesNotMatch(shell, /\bhero\b|DashboardHero|MySanctuaryHero/);
  assert.doesNotMatch(shell, /useDesktopDashboard|DesktopDashboardHome|MobileDashboardHome|isDesktop/);
  assert.doesNotMatch(css, /\.cl-dashboard-desktop\s*\{\s*display:\s*none/);
  assert.doesNotMatch(css, /\.cl-mobile-home\s*\{\s*display:\s*none/);
  assert.match(home, /DashboardLiveStage/);
  assert.match(home, /DASHBOARD_UTILITIES/);
  assert.match(home, /StayConnectedPrompt/);
  assert.match(home, /MyConvocationCard/);
  assert.match(home, /TodayScheduleCard/);
  assert.match(home, /My Tickets/);
  assert.match(home, /My Housing/);
  assert.doesNotMatch(home, /TicketStoreClient|HousingExperience/);
  assert.doesNotMatch(home, /DashboardHero|MySanctuaryHero|\/my-sanctuary\/banner\.png/);
  assert.doesNotMatch(home, /No issued event tickets\."/);
  assert.doesNotMatch(home, /No housing preference submitted\."/);
  assert.doesNotMatch(topBar, /cogic-seal\.png|cl-topbar__account-copy|ChevronDown|AttendeeDesktopNav/);
  for (const label of ["Home", "Registration", "COGIC Live", "Giving", "Travel"]) {
    assert.match(primaryNav, new RegExp(label));
    assert.match(mobileNav, /ATTENDEE_PRIMARY_NAV/);
  }
  assert.match(css, /\.cl-bottom-nav[\s\S]*position:\s*fixed/);
  assert.match(css, /--cl-mobile-shell-max:\s*430px/);
  assert.match(css, /\.cl-dash\s*\{[\s\S]*width:\s*min\(100%,\s*var\(--cl-mobile-shell-max\)\)/);
  assert.match(css, /\.cl-bottom-nav\s*\{[\s\S]*left:\s*50%[\s\S]*transform:\s*translateX\(-50%\)/);
  assert.doesNotMatch(css, /\.cl-bottom-nav\s*\{\s*display:\s*none\s*!important/);
  assert.match(css, /\.cl-dashboard-media[\s\S]*aspect-ratio:\s*9\s*\/\s*16/);
  assert.match(css, /\.cl-dashboard-media__artwork[\s\S]*object-fit:\s*contain/);
  assert.match(css, /\.cl-dashboard-media__bishops[\s\S]*width:\s*100%/);
  assert.match(css, /\.cl-dash \.cl-mobile-home \.cl-live-stage[\s\S]*border:\s*1px solid rgb\(201 162 39 \/ 28%\)/);
  assert.match(css, /\.cl-mobile-home[\s\S]*padding:\s*clamp\(30rem,\s*118vw,\s*32rem\)/);
  assert.doesNotMatch(css, /cl-hero|my-sanctuary-hero/);
});
