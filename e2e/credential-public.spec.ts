import { expect, test } from "@playwright/test";

test.describe("Phase 5B public credential experience", () => {
  test("clean /c renders unavailable without session cookie", async ({ page }) => {
    const response = await page.goto("/c");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Credential unavailable" })).toBeVisible();
    await expect(page.getByText(/This credential is unavailable/i)).toBeVisible();
    await expect(page.locator("nav")).toHaveCount(0);
  });

  test("ingress redirects malformed token-bearing URL to clean /c", async ({ request }) => {
    const response = await request.get("/c/not-a-valid-token", { maxRedirects: 0 });
    expect(response.status()).toBe(303);
    expect(response.headers()["location"]).toMatch(/\/c$/);
    expect(response.headers()["location"]).not.toContain("not-a-valid-token");
  });

  test("security headers are present on ingress and /c", async ({ request }) => {
    const ingress = await request.get("/c/not-a-valid-token", { maxRedirects: 0 });
    expect(ingress.headers()["cache-control"]).toMatch(/no-store/);
    expect(ingress.headers()["referrer-policy"]).toBe("no-referrer");
    expect(ingress.headers()["x-robots-tag"]).toMatch(/noindex/);

    const clean = await request.get("/c");
    expect(clean.headers()["referrer-policy"]).toBe("no-referrer");
    expect(clean.headers()["x-robots-tag"]).toMatch(/noindex/);
    const cacheControl = clean.headers()["cache-control"] ?? "";
    expect(cacheControl.includes("no-store") || cacheControl.includes("no-cache")).toBe(
      true,
    );
  });

  test("refreshing /c does not keep token in URL", async ({ page }) => {
    await page.goto("/c");
    expect(page.url()).toMatch(/\/c$/);
    await page.reload();
    expect(page.url()).toMatch(/\/c$/);
    expect(page.url()).not.toMatch(/\/c\/[A-Za-z0-9_-]{43}/);
  });

  test("javascript-disabled HTML remains understandable", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const response = await page.goto("/c");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Credential unavailable" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Contact registration support" })).toBeVisible();
    await context.close();
  });

  test("200% zoom layout avoids horizontal scroll", async ({ page }) => {
    await page.goto("/c");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
