import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  MAX_GIVING_NOTE_LENGTH,
  QUICK_GIVING_AMOUNTS_CENTS,
  validateGivingCheckoutInput,
} from "@/lib/giving/validation";
import { listActiveGivingFunds, getGivingFund } from "@/lib/giving/funds";
import {
  COGIC_GIVING_ORG,
  COGIC_GIVING_SEAL_SRC,
  COGIC_GIVING_TAGLINE,
} from "@/lib/giving/brand";

describe("COGIC Giving validation", () => {
  it("accepts quick amounts with an active fund", () => {
    for (const amountInCents of QUICK_GIVING_AMOUNTS_CENTS) {
      const result = validateGivingCheckoutInput({
        amountInCents,
        fundKey: "tithes",
      });
      assert.equal(result.ok, true);
    }
    assert.deepEqual([...QUICK_GIVING_AMOUNTS_CENTS], [2500, 5000, 10000, 25000]);
  });

  it("accepts custom valid amounts and sanitizes notes", () => {
    const result = validateGivingCheckoutInput({
      amountInCents: 7550,
      fundKey: "offering",
      note: "  For the saints  ",
      paymentMethod: "ach",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.note, "For the saints");
      assert.equal(result.value.fundKey, "offering");
      assert.equal(result.value.frequency, "one_time");
      assert.equal(result.value.paymentMethod, "ach");
    }
  });

  it("accepts real Giving payment rails and rejects unknown methods", () => {
    for (const paymentMethod of ["card", "apple_pay", "ach"] as const) {
      const result = validateGivingCheckoutInput({
        amountInCents: 2500,
        fundKey: "tithes",
        paymentMethod,
      });
      assert.equal(result.ok, true);
    }
    assert.equal(
      validateGivingCheckoutInput({
        amountInCents: 2500,
        fundKey: "tithes",
        paymentMethod: "cash",
      }).ok,
      false,
    );
  });

  it("rejects invalid amounts and inactive/unknown funds", () => {
    assert.equal(
      validateGivingCheckoutInput({ amountInCents: 10, fundKey: "tithes" }).ok,
      false,
    );
    assert.equal(
      validateGivingCheckoutInput({ amountInCents: 2500, fundKey: "unknown" }).ok,
      false,
    );
    assert.equal(
      validateGivingCheckoutInput({
        amountInCents: 2500,
        fundKey: "tithes",
        note: "x".repeat(MAX_GIVING_NOTE_LENGTH + 40),
      }).ok,
      true,
    );
    const longNote = validateGivingCheckoutInput({
      amountInCents: 2500,
      fundKey: "general_fund",
      note: "x".repeat(MAX_GIVING_NOTE_LENGTH + 40),
    });
    if (longNote.ok) {
      assert.equal(longNote.value.note?.length, MAX_GIVING_NOTE_LENGTH);
    }
  });

  it("exposes four active funds and COGIC branding assets", () => {
    const funds = listActiveGivingFunds();
    assert.equal(funds.length, 4);
    assert.deepEqual(
      funds.map((f) => f.label),
      ["Tithes", "Offering", "Missions", "General Fund"],
    );
    assert.ok(getGivingFund("tithes")?.active);
    assert.equal(COGIC_GIVING_SEAL_SRC, "/branding/cogic-seal.png");
    assert.equal(COGIC_GIVING_ORG.name, "Church of God in Christ, Inc.");
    assert.equal(COGIC_GIVING_ORG.location, "Memphis, Tennessee");
    assert.ok(COGIC_GIVING_TAGLINE.length > 0);

    const sealPath = path.join(process.cwd(), "public", "branding", "cogic-seal.png");
    assert.equal(existsSync(sealPath), true);
  });

  it("does not invent demo totals or fake payment success fields", () => {
    const result = validateGivingCheckoutInput({
      amountInCents: 2500,
      fundKey: "missions",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal("totalRaised" in result.value, false);
      assert.equal("demo" in result.value, false);
      assert.equal(result.value.frequency, "one_time");
    }
  });
});
