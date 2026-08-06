import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");

describe("COGIC Giving UI and checkout contract", () => {
  it("uses official branding and semantic interactive controls", async () => {
    const [brand, amount, quick, funds, note, methods, submit] = await Promise.all([
      read("components/giving/GivingBrandHeader.tsx"),
      read("components/giving/GivingAmountInput.tsx"),
      read("components/giving/GivingQuickAmounts.tsx"),
      read("components/giving/GivingFundSelector.tsx"),
      read("components/giving/GivingNoteField.tsx"),
      read("components/giving/GivingPaymentMethods.tsx"),
      read("components/giving/GivingSubmitButton.tsx"),
    ]);
    assert.match(brand, /COGIC_GIVING_SEAL_SRC/);
    assert.match(amount, /inputMode="decimal"/);
    assert.match(amount, /htmlFor="cogic-giving-amount-input"/);
    assert.match(quick, /aria-pressed=\{pressed\}/);
    assert.match(funds, /listActiveGivingFunds/);
    assert.match(funds, /aria-pressed=\{pressed\}/);
    assert.match(note, /Add a short note\.\.\./);
    assert.match(methods, /aria-pressed=\{selected === "card"\}/);
    assert.match(submit, /disabled=\{disabled \|\| loading\}/);
    assert.match(submit, /aria-busy=\{loading\}/);
  });

  it("uses only production Card and Stripe Link checkout", async () => {
    const [methods, checkout] = await Promise.all([
      read("components/giving/GivingPaymentMethods.tsx"),
      read("app/api/checkout/route.ts"),
    ]);
    assert.match(methods, /Card \/ Link/);
    assert.doesNotMatch(methods, /Apple Pay|Bank|Cash App|Givelify/);
    assert.match(checkout, /payment_method_types:\s*\["card", "link"\]/);
    assert.match(checkout, /validateGivingCheckoutInput/);
    assert.match(checkout, /status:\s*"pending"/);
    assert.doesNotMatch(checkout, /demo|mock|fake_success/i);
  });

  it("preserves fluid responsive and safe-area layout rules", async () => {
    const css = await read("app/giving/giving.css");
    assert.match(css, /width:\s*min\(100%, 64rem\)/);
    assert.match(css, /overflow-x:\s*hidden/);
    assert.match(css, /overflow-y:\s*auto/);
    assert.match(css, /env\(safe-area-inset-top\)/);
    assert.match(css, /env\(safe-area-inset-bottom/);
    assert.match(css, /@media \(max-width: 599px\)/);
    assert.match(css, /@media \(orientation: landscape\)/);
  });
});
