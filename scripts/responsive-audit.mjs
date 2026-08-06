import { chromium } from "playwright";

const baseUrl = process.env.RESPONSIVE_AUDIT_BASE_URL ?? "http://127.0.0.1:3000";
const routes = (process.env.RESPONSIVE_AUDIT_ROUTES ??
  "/,/login,/create-account,/register,/register/review,/attendee-dashboard,/live,/program,/giving,/replays,/my-convocation,/music,/buy-seeds,/contact-us,/updates,/c,/c/not-a-valid-token,/not-a-real-route")
  .split(",")
  .filter(Boolean);

const viewports = [
  [320, 568],
  [360, 800],
  [375, 667],
  [390, 844],
  [412, 915],
  [430, 932],
  [667, 375],
  [844, 390],
  [915, 412],
  [600, 960],
  [768, 1024],
  [820, 1180],
  [1024, 768],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
  [390, 844, 2],
  [1024, 768, 2],
];

const browser = await chromium.launch({ headless: true });
const failures = [];

try {
  for (const [width, height, textScale = 1] of viewports) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();

    for (const route of routes) {
      let response;
      try {
        response = await page.goto(`${baseUrl}${route}`, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
        if (textScale > 1) {
          await page.addStyleTag({ content: `html { font-size: ${textScale * 100}% !important; }` });
        }
        await page.waitForTimeout(250);
      } catch (error) {
        failures.push({ route, width, height, textScale, kind: "navigation", detail: error.message });
        continue;
      }

      const result = await page.evaluate(() => {
        const root = document.documentElement;
        const viewportWidth = root.clientWidth;
        const overflow = [];
        const clipped = [];
        const smallTargets = [];
        const nodes = Array.from(document.body.querySelectorAll("*"));

        for (const element of nodes) {
          if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) continue;
          if (element.closest(".sr-only, [aria-hidden='true']")) continue;
          const style = getComputedStyle(element);
          if (style.display === "none" || style.visibility === "hidden") continue;
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;

          if (!element.closest("[data-responsive-overflow-allow]")) {
            if (rect.left < -1 || rect.right > viewportWidth + 1) {
              overflow.push({
                tag: element.tagName.toLowerCase(),
                className: typeof element.className === "string" ? element.className.slice(0, 100) : "",
                left: Math.round(rect.left),
                right: Math.round(rect.right),
              });
            }
          }

          if (
            element instanceof HTMLElement &&
            element.childElementCount === 0 &&
            element.textContent?.trim() &&
            ["hidden", "clip"].includes(style.overflowX) &&
            element.scrollWidth > element.clientWidth + 1
          ) {
            clipped.push({
              tag: element.tagName.toLowerCase(),
              text: element.textContent.trim().slice(0, 80),
            });
          }

          const wrappingLabel = element.closest("label");
          const labelRect = wrappingLabel?.getBoundingClientRect();
          const hasLargeLabel = Boolean(labelRect && labelRect.width >= 44 && labelRect.height >= 44);
          const isTarget =
            element.matches("button, select, textarea, [role=button]") ||
            (element.matches("input:not([type=hidden]):not([type=file])") && !hasLargeLabel) ||
            (element.matches("a[href]") && ["flex", "inline-flex", "grid", "block"].includes(style.display));
          if (
            isTarget &&
            !element.hasAttribute("data-compact-control") &&
            (rect.width < 44 || rect.height < 44)
          ) {
            smallTargets.push({
              tag: element.tagName.toLowerCase(),
              label: (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 80),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            });
          }
        }

        return {
          documentOverflow: root.scrollWidth - root.clientWidth,
          overflow: overflow.slice(0, 12),
          clipped: clipped.slice(0, 12),
          smallTargets: smallTargets.slice(0, 12),
        };
      });

      if (
        result.documentOverflow > 1 ||
        result.overflow.length ||
        result.clipped.length ||
        result.smallTargets.length
      ) {
        failures.push({
          route,
          finalUrl: page.url(),
          status: response?.status() ?? null,
          width,
          height,
          textScale,
          kind: "layout",
          ...result,
        });
      }
    }

    await context.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ok: true, routes: routes.length, viewports: viewports.length }, null, 2));
}
