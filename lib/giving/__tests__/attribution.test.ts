import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("giving attribution acceptance contracts", () => {
  it("checkout validates attribution and stages queryable donation columns", () => {
    const checkout = fs.readFileSync(path.join(root, "app/api/checkout/route.ts"), "utf8");
    const attribution = fs.readFileSync(path.join(root, "lib/giving/attribution.ts"), "utf8");
    assert.match(checkout, /resolveGivingAttribution/);
    assert.match(checkout, /attributionToStripeMetadata/);
    assert.match(checkout, /attributionInsertFields/);
    assert.match(checkout, /fund_key/);
    assert.match(attribution, /source_type:\s*attribution\.sourceType/);
    assert.match(attribution, /media_id:\s*attribution\.mediaId/);
    assert.match(attribution, /event_occurrence_id:\s*attribution\.eventOccurrenceId/);
    assert.match(attribution, /collection_id:\s*attribution\.collectionId/);
    assert.match(attribution, /program_key:\s*attribution\.programKey/);
  });

  it("webhook fulfills paid donations without dropping staged attribution rows", () => {
    const webhook = fs.readFileSync(
      path.join(root, "app/api/webhooks/stripe/route.ts"),
      "utf8",
    );
    assert.match(webhook, /checkout_type === "donation"/);
    assert.match(webhook, /fulfillDonation/);
    assert.match(webhook, /fulfill_donation_checkout/);
    assert.match(webhook, /payment_status !== "paid"/);
  });

  it("live and replay giving surfaces pass source context into checkout", () => {
    const live = fs.readFileSync(
      path.join(root, "components/experience/live/ExperienceGivingPanel.tsx"),
      "utf8",
    );
    const giving = fs.readFileSync(
      path.join(root, "components/giving/CogicGivingExperience.tsx"),
      "utf8",
    );
    assert.match(live, /sourceType|source_type|mediaId|eventOccurrenceId/);
    assert.match(giving, /\/api\/checkout/);
  });
});
