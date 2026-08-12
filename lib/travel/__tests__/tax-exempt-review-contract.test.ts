import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (filePath: string) => fs.readFileSync(path.join(root, filePath), "utf8");

describe("owner tax-exempt review route", () => {
  it("gates on isPlatformOwner and stamps reviewed_by from session via profileId", () => {
    const route = read("app/api/owner/travel/corporate/tax-exempt/review/route.ts");
    const mutator = read("lib/travel/corporate/tax-exempt-review.ts");

    assert.match(route, /resolveServerOrgContext/);
    assert.match(route, /isPlatformOwner !== true/);
    assert.match(route, /status: 403/);
    assert.doesNotMatch(route, /status: 401/);
    assert.match(route, /export async function GET/);
    assert.match(route, /listPendingReviewTaxProfiles/);
    assert.match(route, /profileId/);
    assert.match(route, /action !== "verify"/);
    assert.match(route, /ownerJsonResponse\(\{\s*profile/);
    assert.doesNotMatch(route, /LEADERSHIP_ROLES|role === "Pastor"/);
    assert.match(mutator, /getChurchTaxProfileById/);
    assert.match(mutator, /listPendingReviewTaxProfiles/);
    assert.match(mutator, /verification_status: "verified"/);
    assert.match(mutator, /verification_status: "rejected"/);
    assert.match(mutator, /reviewed_by: input\.reviewerUserId/);
    assert.match(mutator, /reviewed_at/);
    assert.doesNotMatch(mutator, /reviewed_by:\s*source|verified_by:\s*input/);
  });

  it("ships review route and mutator files", () => {
    assert.ok(
      fs.existsSync(
        path.join(root, "app/api/owner/travel/corporate/tax-exempt/review/route.ts"),
      ),
    );
    assert.ok(fs.existsSync(path.join(root, "lib/travel/corporate/tax-exempt-review.ts")));
  });
});
