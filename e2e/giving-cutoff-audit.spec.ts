import { expect, test } from "@playwright/test";

const viewports = [
  [320, 568], [360, 800], [375, 812], [390, 844], [430, 932],
  [568, 320], [844, 390], [768, 1024], [1024, 1366], [1024, 768],
  [1440, 900], [1920, 1080],
] as const;

test("Giving form remains fully reachable without nested viewport clipping", async ({ page }) => {
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto("http://localhost:3000/giving");
    const surface = page.locator(".cogic-giving-page");
    const metrics = await surface.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight }));
    const security = page.locator(".cogic-giving-security");
    await expect(security, `${width}x${height} security footer`).toBeVisible();
    const box = await security.boundingBox();
    expect(box, `${width}x${height} security footer bounds`).not.toBeNull();
    expect(box!.y + box!.height, `${width}x${height} bottom is reachable`).toBeLessThanOrEqual(height + 1);
    expect(metrics.scrollHeight, `${width}x${height} surface has content`).toBeGreaterThan(0);
    expect(metrics.overflowY, `${width}x${height} avoids nested vertical scrolling`).toBe("visible");
  }
});
