import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("Watch Live attendee nav routes to /live", async () => {
  const [mobileNav, primaryNav, bottomNav, liveStage, liveNav] = await Promise.all([
    source("components/dashboard/DashboardMobileNav.tsx"),
    source("lib/navigation/attendee-primary-nav.ts"),
    source("lib/navigation/bottom-nav-config.ts"),
    source("components/dashboard/DashboardLiveStage.tsx"),
    source("lib/experience/useAttendeeLiveNavTarget.ts"),
  ]);
  assert.match(mobileNav, /ATTENDEE_PRIMARY_NAV/);
  assert.match(primaryNav, /label:\s*"Watch Live"[\s\S]*href:\s*"\/live"/);
  assert.match(bottomNav, /ATTENDEE_PRIMARY_NAV/);
  assert.match(liveStage, /"\/live"/);
  assert.match(liveNav, /EXPERIENCE_LIVE_PATH/);
  assert.match(await source("lib/experience/live-routes.ts"), /EXPERIENCE_LIVE_PATH = "\/live"/);
});

test("/live is the full Live Hub with cinematic player feature", async () => {
  const [page, hub, css, loader] = await Promise.all([
    source("app/live/page.tsx"),
    source("components/live/hub/LiveHubClient.tsx"),
    source("app/live/live-hub.css"),
    source("lib/live/load-live-hub.ts"),
  ]);
  assert.match(page, /loadLiveHub/);
  assert.match(page, /LiveHubClient/);
  assert.match(page, /live-hub\.css/);
  assert.match(hub, /DashboardTopBar/);
  assert.match(hub, /DashboardMobileNav/);
  assert.doesNotMatch(hub, /live-hub__topbar|AttendeeDesktopNav/);
  assert.match(hub, /live-hub__player-shell/);
  assert.match(hub, /variant="hub"/);
  assert.match(hub, /Up Next/);
  assert.match(hub, /Continue Watching/);
  assert.match(hub, /Recent Replays/);
  assert.match(hub, /title="Saved"/);
  assert.match(hub, /data\.watchHistory/);
  assert.match(hub, /Archives \/ Collections/);
  assert.match(hub, /Sow Now/);
  assert.match(hub, /LiveShareButton/);
  assert.match(hub, /scrollToPlayer/);
  assert.match(css, /\.live-hub__player-shell/);
  assert.match(css, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(loader, /resolveAuthoritativeLiveState/);
  assert.match(loader, /loadPublishedReplays/);
  assert.match(loader, /listPublishedArchives/);
  assert.match(loader, /seed_wallets/);
});

test("isolated attendee live page is removed from normal flow", async () => {
  const [page, streamPage, routes] = await Promise.all([
    source("app/live/page.tsx"),
    source("app/live/[streamId]/page.tsx"),
    source("lib/routes.ts"),
  ]);
  assert.match(page, /LiveHubClient/);
  assert.match(streamPage, /redirect\("\/live"\)/);
  // /live must not be locked into the fixed mobile artboard tab shell.
  assert.doesNotMatch(
    routes,
    /MOBILE_ARTBOARD_TAB_EXACT\s*=\s*\[[^\]]*"\/live"/s,
  );
});

test("Watch Live control stays within Hub and live experience supports hub embed", async () => {
  const [hub, experience] = await Promise.all([
    source("components/live/hub/LiveHubClient.tsx"),
    source("components/experience/live/LiveExperienceClient.tsx"),
  ]);
  assert.match(hub, /onClick=\{scrollToPlayer\}/);
  assert.doesNotMatch(hub, /href="\/live\/[^"]+"/);
  assert.match(experience, /variant\?: "standalone" \| "hub"/);
  assert.match(experience, /isHub/);
});

test("truthful OFFLINE/LIVE copy and no demo attendee media on Live Hub", async () => {
  const [hub, loader, experience] = await Promise.all([
    source("components/live/hub/LiveHubClient.tsx"),
    source("lib/live/load-live-hub.ts"),
    source("components/experience/live/LiveExperienceClient.tsx"),
  ]);
  assert.match(hub, /Programming will appear here as soon as it is available/);
  assert.match(hub, /featuredReplay/);
  assert.match(loader, /featuredReplay: replays\[0\] \?\? null/);
  assert.doesNotMatch(hub, /Open Live Lobby/);
  assert.match(hub, /No upcoming published broadcasts/);
  assert.match(hub, /No published replays are available yet/);
  assert.match(loader, /resolveAuthoritativeLiveState/);
  assert.doesNotMatch(hub, /test-streams\.mux\.dev|sample\.m3u8|fake viewer/i);
  assert.match(experience, /isDemoManifestPlaybackUrl/);
});

test("Live Hub giving, sharing, favorites, history, archives, and seed truthfulness", async () => {
  const [hub, monetization, giving, share, canonical] = await Promise.all([
    source("components/live/hub/LiveHubClient.tsx"),
    source("components/live/hub/LiveMonetizationPanel.tsx"),
    source("components/experience/live/ExperienceGivingPanel.tsx"),
    source("components/live/LiveShareButton.tsx"),
    source("lib/sharing/canonical.ts"),
  ]);
  assert.match(hub, /LiveMonetizationPanel/);
  assert.match(monetization, /ExperienceGivingPanel/);
  assert.match(giving, /sourceType:\s*"live"/);
  assert.match(share, /buildCanonicalLiveShareUrl/);
  assert.match(canonical, /\/live/);
  assert.match(hub, /seedBalance/);
  assert.match(hub, /favorites/);
  assert.match(hub, /watchHistory/);
  assert.match(hub, /archives/);
  assert.match(hub, /LiveRoomChatPanel/);
  assert.match(hub, /DashboardMobileNav/);
});

test("Live Hub Convocation dock exposes only real attendee routes", async () => {
  const hub = await source("components/live/hub/LiveHubClient.tsx");
  assert.match(hub, /live-hub__convocation-dock/);
  for (const route of ["program", "register", "replays", "my-sanctuary", "updates"]) {
    assert.ok(hub.includes(`href="/${route}"`));
  }
  assert.doesNotMatch(hub, /href=["']\/(tickets|exhibitors|maps)["']/);
});

test("mobile navigation marks Watch Live active on /live", async () => {
  const [nav, primary] = await Promise.all([
    source("components/dashboard/DashboardMobileNav.tsx"),
    source("lib/navigation/attendee-primary-nav.ts"),
  ]);
  assert.match(nav, /ATTENDEE_PRIMARY_NAV/);
  assert.match(nav, /isAttendeePrimaryNavActive/);
  assert.match(primary, /href:\s*"\/live"/);
  assert.match(primary, /match:\s*"live"/);
  assert.match(primary, /isAttendeeLiveSurfacePath/);
});
