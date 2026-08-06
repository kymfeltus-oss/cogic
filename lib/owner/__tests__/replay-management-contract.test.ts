import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("owner replay / archive management contracts", () => {
  it("exposes owner replay and archive surfaces", () => {
    assert.equal(fs.existsSync(path.join(root, "app/owner/replays/page.tsx")), true);
    assert.equal(fs.existsSync(path.join(root, "app/owner/archives/page.tsx")), true);
    assert.equal(fs.existsSync(path.join(root, "app/api/owner/replays/route.ts")), true);
    assert.equal(fs.existsSync(path.join(root, "app/api/owner/archives/route.ts")), true);
    assert.equal(fs.existsSync(path.join(root, "app/api/owner/collections/route.ts")), true);
  });

  it("wires side menu to replay and archive tools", () => {
    const menu = fs.readFileSync(
      path.join(root, "components/owner/OwnerProductionSideMenu.tsx"),
      "utf8",
    );
    assert.match(menu, /\/owner\/replays/);
    assert.match(menu, /\/owner\/archives/);
    assert.match(menu, /\/owner\/events/);
  });

  it("owner replay UI uses real APIs and empty state copy", () => {
    const ui = fs.readFileSync(
      path.join(root, "components/owner/ReplayManagementClient.tsx"),
      "utf8",
    );
    assert.match(ui, /\/api\/owner\/replays/);
    assert.match(ui, /No recordings match this filter/);
    assert.doesNotMatch(ui, /mock|demo|fake/i);
  });

  it("public archive routes exist for year isolation browsing", () => {
    assert.equal(
      fs.existsSync(path.join(root, "app/replays/archive/[slug]/page.tsx")),
      true,
    );
    assert.equal(
      fs.existsSync(
        path.join(root, "app/replays/collections/[archiveSlug]/[collectionSlug]/page.tsx"),
      ),
      true,
    );
  });

  it("checkout stamps and stages attribution fields", () => {
    const checkout = fs.readFileSync(
      path.join(root, "app/api/checkout/route.ts"),
      "utf8",
    );
    const attribution = fs.readFileSync(
      path.join(root, "lib/giving/attribution.ts"),
      "utf8",
    );
    assert.match(checkout, /resolveGivingAttribution/);
    assert.match(checkout, /attributionInsertFields/);
    assert.match(checkout, /attributionToStripeMetadata/);
    assert.match(checkout, /mediaId/);
    assert.match(attribution, /source_type/);
    assert.match(attribution, /media_id/);
  });
});
