import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function missing(relativePath: string) {
  try {
    await access(path.join(root, relativePath));
    return false;
  } catch {
    return true;
  }
}

test("retired desktop dashboard presentation files are gone", async () => {
  assert.equal(await missing("components/dashboard/DesktopDashboardHome.tsx"), true);
  assert.equal(await missing("components/dashboard/MobileDashboardHome.tsx"), true);
  assert.equal(await missing("lib/dashboard/use-desktop-dashboard.ts"), true);
  assert.equal(await missing("components/navigation/AttendeeDesktopNav.tsx"), true);
  assert.equal(await missing("lib/navigation/attendee-desktop-nav.ts"), true);
});

test("one universal shell mounts home + dock without XOR", async () => {
  const [shell, rootShell, primary, bottom] = await Promise.all([
    source("components/dashboard/DashboardShell.tsx"),
    source("components/RootLayoutShell.tsx"),
    source("lib/navigation/attendee-primary-nav.ts"),
    source("components/navigation/BottomNavigation.tsx"),
  ]);
  assert.match(shell, /AttendeeDashboardHome/);
  assert.match(shell, /DashboardMobileNav/);
  assert.doesNotMatch(shell, /useDesktopDashboard|DesktopDashboardHome|MobileDashboardHome|AttendeeDesktopNav/);
  assert.doesNotMatch(rootShell, /isTravelHubRoute|AttendeeDesktopNav/);
  assert.match(bottom, /DashboardMobileNav/);
  assert.match(primary, /ATTENDEE_PRIMARY_NAV/);
  for (const label of ["Home", "Watch Live", "Program", "My Sanctuary", "Give"]) {
    assert.match(primary, new RegExp(label));
  }
});

test("Giving and Travel no longer ship separate desktop navigation chrome", async () => {
  const [giving, givingCss, travel, routes, css, liveHub, sharedTop] = await Promise.all([
    source("components/giving/CogicGivingExperience.tsx"),
    source("app/giving/giving.css"),
    source("app/travel/page.tsx"),
    source("lib/routes.ts"),
    source("app/my-convocation/dashboard.css"),
    source("components/live/hub/LiveHubClient.tsx"),
    source("components/navigation/AttendeeSharedTopBar.tsx"),
  ]);
  assert.doesNotMatch(giving, /cogic-giving-reference-nav|cogic-giving-summary|Kingdom Impact/);
  assert.doesNotMatch(givingCss, /cogic-giving-reference-nav|Desktop Giving experience/);
  assert.doesNotMatch(travel, /className="ct-nav"|ct-progress|You're all set/);
  assert.doesNotMatch(routes, /"\/giving"/);
  assert.doesNotMatch(css, /menu-bar-background\.png/);
  assert.match(css, /Mobile-only attendee dashboard/);
  assert.doesNotMatch(css, /cl-topbar__phrase-wrap|cl-sidebar|cl-topnav|cl-desktop|@media\s*\(min-width/);
  assert.match(css, /--cl-mobile-shell-max:\s*430px/);
  assert.match(css, /\.cl-bottom-nav[\s\S]*position:\s*fixed/);
  assert.doesNotMatch(css, /\.cl-bottom-nav\s*\{\s*display:\s*none\s*!important/);
  assert.match(liveHub, /DashboardTopBar/);
  assert.doesNotMatch(liveHub, /live-hub__topbar/);
  assert.match(sharedTop, /cl-topbar__phrase/);
  assert.doesNotMatch(sharedTop, /cl-btn--compact|>My Account</);
});

test("Registration, Live, Program, Replays, Updates stay single-tree routes", async () => {
  const files = [
    "app/register/page.tsx",
    "components/live/hub/LiveHubClient.tsx",
    "components/program/ConvocationProgram.tsx",
    "app/replays/page.tsx",
    "app/updates/page.tsx",
  ];
  const combined = (await Promise.all(files.map(source))).join("\n");
  assert.doesNotMatch(combined, /useDesktopDashboard|DesktopDashboardHome|AttendeeDesktopNav|isDesktop\s*\?/);
});
