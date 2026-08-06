import { expect, test } from "@playwright/test";

const viewports = [
  [320, 568], [360, 800], [375, 812], [390, 844], [393, 852], [412, 915], [430, 932],
  [768, 1024], [820, 1180], [1024, 1366], [1024, 768], [1280, 720], [1366, 768],
  [1440, 900], [1536, 864], [1920, 1080],
] as const;

test("Giving controls support amount, fund, note, payment, and keyboard interaction", async ({ page }) => {
  await page.goto("http://localhost:3000/giving");
  const amount = page.getByLabel("Gift amount in US dollars");
  await page.getByRole("button", { name: "$25", exact: true }).click();
  await expect(amount).toHaveValue("25.00");
  await amount.fill("75.50");
  await expect(amount).toHaveValue("75.50");
  await page.getByRole("button", { name: "Offering" }).click();
  await expect(page.getByRole("button", { name: "Offering" })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Optional giving note").fill("For the mission");
  const card = page.getByRole("button", { name: /Debit \/ Credit Card/ });
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(card).toHaveAttribute("aria-pressed", "true");
  const applePay = page.getByRole("button", { name: /Apple Pay/ });
  await applePay.click();
  await expect(applePay).toHaveAttribute("aria-pressed", "true");
  const ach = page.getByRole("button", { name: /ACH Bank/ });
  await ach.click();
  await expect(ach).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /Give Now/ })).toBeEnabled();
});

test("Giving layout has no horizontal overflow at required viewports", async ({ page }) => {
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto("http://localhost:3000/giving");
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.scrollWidth, `${width}x${height} horizontal overflow`).toBeLessThanOrEqual(metrics.clientWidth);

    for (const locator of [
      page.getByAltText("Church of God in Christ seal"),
      page.getByLabel("Gift amount in US dollars"),
      page.getByRole("button", { name: "$25", exact: true }),
      page.getByRole("button", { name: "General Fund" }),
      page.getByRole("button", { name: /Debit \/ Credit Card/ }),
      page.getByRole("button", { name: /Apple Pay/ }),
      page.getByRole("button", { name: /ACH Bank/ }),
      page.getByRole("button", { name: /Give Now/ }),
    ]) {
      const box = await locator.boundingBox();
      expect(box, `${width}x${height} missing control`).not.toBeNull();
      expect(box!.x, `${width}x${height} left clipping`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `${width}x${height} right clipping`).toBeLessThanOrEqual(width + 0.5);
    }

    for (const button of [
      page.getByRole("button", { name: "$25", exact: true }),
      page.getByRole("button", { name: "General Fund" }),
      page.getByRole("button", { name: /Debit \/ Credit Card/ }),
      page.getByRole("button", { name: /Apple Pay/ }),
      page.getByRole("button", { name: /ACH Bank/ }),
      page.getByRole("button", { name: /Give Now/ }),
    ]) {
      const box = await button.boundingBox();
      expect(box!.height, `${width}x${height} touch target`).toBeGreaterThanOrEqual(44);
    }
  }
});
