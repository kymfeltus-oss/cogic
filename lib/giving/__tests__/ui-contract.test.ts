import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");

describe("COGIC Giving UI and checkout contract", () => {
  it("uses official branding and semantic interactive controls", async () => {
    const [experience, amount, quick, funds, note, methods, submit] = await Promise.all([
      read("components/giving/CogicGivingExperience.tsx"),
      read("components/giving/GivingAmountInput.tsx"),
      read("components/giving/GivingQuickAmounts.tsx"),
      read("components/giving/GivingFundSelector.tsx"),
      read("components/giving/GivingNoteField.tsx"),
      read("components/giving/GivingPaymentMethods.tsx"),
      read("components/giving/GivingSubmitButton.tsx"),
    ]);
    assert.match(experience, /\/giving\/giving_input\.png/);
    assert.doesNotMatch(experience, /GivingBrandHeader/);
    assert.match(amount, /inputMode="decimal"/);
    assert.match(amount, /htmlFor="cogic-giving-amount-input"/);
    assert.match(quick, /aria-pressed=\{pressed\}/);
    assert.match(funds, /funds\.map/);
    assert.match(funds, /aria-pressed=\{pressed\}/);
    assert.match(await read("app/giving/page.tsx"), /listActiveGivingFunds/);
    assert.match(await read("app/api/checkout/route.ts"), /getActiveGivingFund/);
    assert.match(await read("lib/giving/repository.ts"), /from\("giving_funds"\)/);
    assert.match(note, /Add a short note\.\.\./);
    assert.match(methods, /aria-pressed=\{selected === "card"\}/);
    assert.match(submit, /disabled=\{disabled \|\| loading\}/);
    assert.match(submit, /aria-busy=\{loading\}/);
  });

  it("uses real Stripe Checkout rails for cards, Apple Pay, and ACH", async () => {
    const [methods, checkout, webhook] = await Promise.all([
      read("components/giving/GivingPaymentMethods.tsx"),
      read("app/api/checkout/route.ts"),
      read("app/api/webhooks/stripe/route.ts"),
    ]);
    assert.match(methods, /Debit \/ Credit Card/);
    assert.match(methods, />Apple Pay</);
    assert.match(methods, />ACH Bank</);
    assert.doesNotMatch(methods, /Cash App|Givelify/);
    assert.match(checkout, /\["us_bank_account"\]/);
    assert.match(checkout, /\["card"\]/);
    assert.match(checkout, /validateGivingCheckoutInput/);
    assert.match(checkout, /status:\s*"pending"/);
    assert.match(webhook, /checkout\.session\.async_payment_succeeded/);
    assert.match(webhook, /checkout\.session\.async_payment_failed/);
    assert.match(webhook, /session\.payment_status !== "paid"/);
    assert.doesNotMatch(checkout, /demo|mock|fake_success/i);
    assert.match(checkout, /enforceGivingCheckoutRateLimit/);
  });

  it("preserves fluid responsive and safe-area layout rules", async () => {
    const css = await read("app/giving/giving.css");
    assert.match(css, /width:\s*min\(100%, 64rem\)/);
    assert.match(css, /min-height:\s*100dvh/);
    assert.match(css, /height:\s*auto/);
    assert.match(css, /overflow-x:\s*clip/);
    assert.match(css, /overflow-y:\s*visible/);
    assert.match(css, /env\(safe-area-inset-top\)/);
    assert.match(css, /env\(safe-area-inset-bottom/);
    assert.match(css, /@media \(max-width: 599px\)/);
    assert.match(css, /@media \(orientation: landscape\)/);
  });
});
