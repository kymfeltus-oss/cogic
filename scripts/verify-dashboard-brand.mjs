#!/usr/bin/env node

import { chromium } from "playwright";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.DASHBOARD_VERIFY_BASE_URL || "http://localhost:3000";
const authFile = process.env.DASHBOARD_VERIFY_AUTH_FILE;
const useGuestSession = process.env.DASHBOARD_VERIFY_GUEST === "1";
const screenshotDirectory = process.env.DASHBOARD_VERIFY_SCREENSHOT_DIR;
const viewports = [
  ["small_phone", 375, 812],
  ["iphone", 390, 844],
  ["large_phone", 430, 932],
  ["tablet_portrait", 768, 1024],
  ["tablet_landscape", 1024, 768],
  ["desktop", 1440, 900],
];

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  const context = await browser.newContext();
  if (authFile || useGuestSession) {
    const authBody = useGuestSession
      ? { action: "guest" }
      : JSON.parse((await readFile(authFile, "utf8")).replace(/^\uFEFF/, ""));
    const authResponse = await context.request.post(`${baseUrl}/api/auth`, { data: authBody });
    if (!authResponse.ok()) throw new Error(`Attendee authentication failed with HTTP ${authResponse.status()}.`);
  }
  if (screenshotDirectory) await mkdir(screenshotDirectory, { recursive: true });

  for (const [name, width, height] of viewports) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height });
    const response = await page.goto(`${baseUrl}/my-convocation`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForSelector(".cl-dash", { timeout: 10_000 });
    const searchInput = page.locator('.cl-topbar__search input[type="search"]');
    await searchInput.fill("live");
    const searchResultsFunctional = await page.locator('.cl-topbar__search-results a[href="/live"]').isVisible();
    await searchInput.fill("");
    await page.getByRole("button", { name: "Open attendee profile" }).click();
    const profileControlFunctional = await page.locator('[role="dialog"][aria-modal="true"]').isVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    const result = await page.evaluate(async () => {
      const dashboard = document.querySelector(".cl-dash");
      const nav = document.querySelector(".cl-bottom-nav");
      const search = document.querySelector('.cl-topbar__search input[type="search"]');
      const watchLive = document.querySelector('.cl-bottom-nav a[href="/live"]');
      const mobile = window.innerWidth <= 720;
      const navStyle = nav ? getComputedStyle(nav) : null;
      const desktopTopNav = document.querySelector(".cl-topnav");
      const sideRail = document.querySelector(".cl-sidebar");
      const touchTargets = [...document.querySelectorAll(".cl-bottom-nav a")].map((node) => node.getBoundingClientRect());
      if (mobile) {
        window.scrollTo(0, document.documentElement.scrollHeight);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
      const finalContent = document.querySelector(".cl-feature-grid")?.lastElementChild?.getBoundingClientRect();
      const navRect = nav?.getBoundingClientRect();
      const topNavVisible = Boolean(
        desktopTopNav && getComputedStyle(desktopTopNav).display !== "none",
      );
      return {
        dashboard: Boolean(dashboard),
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        searchFunctional: search instanceof HTMLInputElement,
        watchLiveRoute: watchLive?.getAttribute("href") === "/live",
        mobileNavAttached: !mobile || Boolean(navStyle && navStyle.position === "fixed" && navStyle.bottom === "0px" && navStyle.borderRadius === "0px"),
        touchTargets: !mobile || touchTargets.every((rect) => rect.width >= 44 && rect.height >= 44),
        contentHiddenBehindNav: Boolean(mobile && finalContent && navRect && finalContent.bottom > navRect.top),
        semanticHeading: Boolean(document.querySelector("main h1, main h2, .cl-dash__main h1, .cl-dash__main h2")),
        desktopTopNav: mobile ? !topNavVisible : topNavVisible,
        noSideRail: !sideRail || getComputedStyle(sideRail).display === "none",
      };
    });
    result.searchResultsFunctional = searchResultsFunctional;
    result.profileControlFunctional = profileControlFunctional;
    const passed = response?.ok() === true
      && result.dashboard
      && !result.horizontalOverflow
      && result.searchFunctional
      && result.watchLiveRoute
      && result.mobileNavAttached
      && result.touchTargets
      && !result.contentHiddenBehindNav
      && result.semanticHeading
      && result.desktopTopNav
      && result.noSideRail
      && result.searchResultsFunctional
      && result.profileControlFunctional;
    results.push({ name, width, height, status: response?.status() ?? 0, passed, ...result });
    if (screenshotDirectory) {
      await page.screenshot({ path: path.join(screenshotDirectory, `${name}-${width}x${height}.png`), fullPage: true });
    }
    await page.close();
  }
  await context.close();
} finally {
  await browser.close();
}

for (const result of results) console.log(`${result.passed ? "PASS" : "FAIL"}  ${result.name} ${result.width}x${result.height}`);
console.log(JSON.stringify(results, null, 2));
process.exit(results.every((result) => result.passed) ? 0 : 1);
