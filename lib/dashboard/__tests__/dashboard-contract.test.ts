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
    source("lib/navigation/attendee-desktop-nav.ts"),
    source("components/dashboard/GivingCard.tsx"),
    source("components/dashboard/DashboardLiveStage.tsx"),
  ]);
  for (const route of ["/my-convocation", "/live", "/program", "/register", "/giving", "/replays"]) {
    assert.match(nav, new RegExp(route.replace("/", "\\/")));
  }
  assert.doesNotMatch(giving, /248,930|500,000|49%/);
  assert.match(liveStage, /href=\{isNowLive \? "\/live"/);
});

test("attendee dashboard presentation contains no legacy public brand", async () => {
  const files = [
    "components/dashboard/DashboardShell.tsx",
    "components/dashboard/DashboardTopBar.tsx",
    "components/navigation/AttendeeDesktopNav.tsx",
    "components/dashboard/DesktopDashboardHome.tsx",
    "components/dashboard/MobileDashboardHome.tsx",
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

test("dashboard mounts mobile XOR desktop compositions without CSS concealment", async () => {
  const [shell, desktop, mobile, hero, mobileNav, css, hook, topBar] = await Promise.all([
    source("components/dashboard/DashboardShell.tsx"),
    source("components/dashboard/DesktopDashboardHome.tsx"),
    source("components/dashboard/MobileDashboardHome.tsx"),
    source("components/dashboard/DashboardHero.tsx"),
    source("components/dashboard/DashboardMobileNav.tsx"),
    source("app/my-convocation/dashboard.css"),
    source("lib/dashboard/use-desktop-dashboard.ts"),
    source("components/dashboard/DashboardTopBar.tsx"),
  ]);
  assert.match(shell, /useDesktopDashboard/);
  assert.match(shell, /DesktopDashboardHome/);
  assert.match(shell, /MobileDashboardHome/);
  assert.match(shell, /isDesktop \? \(/);
  assert.doesNotMatch(shell, /cl-dashboard-desktop/);
  assert.doesNotMatch(css, /\.cl-dashboard-desktop\s*\{\s*display:\s*none/);
  assert.doesNotMatch(css, /\.cl-mobile-home\s*\{\s*display:\s*none/);
  assert.match(hook, /min-width: 721px/);
  assert.match(desktop, /DashboardLiveStage/);
  assert.match(mobile, /DashboardLiveStage/);
  assert.match(hero, /convocation-banner-bishops-v2\.png/);
  assert.match(hero, /width=\{1983\}/);
  assert.match(hero, /height=\{793\}/);
  assert.doesNotMatch(hero, /\bfill\b/);
  assert.match(desktop, /cl-desktop-utilities/);
  assert.doesNotMatch(desktop, /cl-action-grid--features/);
  assert.doesNotMatch(topBar, /cogic-seal\.png|cl-topbar__account-copy|ChevronDown/);
  for (const label of ["Home", "Watch Live", "Program", "My Sanctuary", "Give"]) {
    assert.match(mobileNav, new RegExp(label));
  }
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /\.cl-bottom-nav[\s\S]*position:\s*fixed/);
  assert.match(css, /\.cl-hero__image[^}]*object-fit:\s*contain/);
  assert.match(css, /--cl-hero-aspect:\s*1983\s*\/\s*793/);
});
