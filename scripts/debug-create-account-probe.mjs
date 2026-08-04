import { chromium } from "playwright";

const page = await chromium.launch({ headless: true }).then((b) =>
  b.newPage({ viewport: { width: 1536, height: 826 } }),
);
await page.goto("http://localhost:3000/create-account", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector(".auth-attendee-overlay-form");

const probe = await page.evaluate(() => {
  const masks = document.querySelectorAll(".create-account-overlay__field-mask");
  const plateFields = document.querySelectorAll(".auth-plate-field");
  const fields = document.querySelectorAll(".auth-attendee-field");
  const form = document.querySelector(".auth-attendee-overlay-form");
  const formRect = form?.getBoundingClientRect();
  const fullName = document.querySelector('[aria-label="Full name"]');
  const fr = fullName?.getBoundingClientRect();
  return {
    maskCount: masks.length,
    plateFieldCount: plateFields.length,
    authFieldCount: fields.length,
    form: formRect ? { w: formRect.width, h: formRect.height, left: formRect.left } : null,
    fullNameField: fr ? { top: fr.top, h: fr.height, minH: fullName ? getComputedStyle(fullName).minHeight : null } : null,
    viewport: { w: innerWidth, h: innerHeight },
  };
});

console.log(JSON.stringify(probe, null, 2));
await page.close();
