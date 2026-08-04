import { chromium } from "playwright";

const page = await chromium.launch({ headless: true }).then((b) =>
  b.newPage({ viewport: { width: 390, height: 844 } }),
);
await page.goto("http://localhost:3000/create-account", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector('[aria-label="Full name"]');

await page.click('[aria-label="Full name"]');
await page.keyboard.type("Jane Doe");
const nameVal = await page.inputValue('[aria-label="Full name"]');

await page.click('[aria-label="Email address"]');
await page.keyboard.type("jane@example.com");
const emailVal = await page.inputValue('[aria-label="Email address"]');

const layers = await page.evaluate(() => ({
  masks: document.querySelectorAll(".create-account-overlay__field-mask").length,
  plates: document.querySelectorAll(".auth-plate-field").length,
}));

console.log(JSON.stringify({ layers, nameVal, emailVal, fillable: nameVal.length > 0 && emailVal.length > 0 }, null, 2));
await page.close();
