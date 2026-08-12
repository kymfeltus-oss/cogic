import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (filePath: string) => fs.readFileSync(path.join(root, filePath), "utf8");

describe("Amadeus corporate group caller", () => {
  it("ships token cache, caller, and owner supplier-search route", () => {
    const caller = read("lib/travel/corporate/amadeus-group-caller.ts");
    const cache = read("lib/travel/corporate/amadeus-token-cache.ts");
    const route = read("app/api/owner/travel/group-requests/supplier-search/route.ts");
    const repo = read("lib/travel/group-booking/repository.ts");

    assert.match(cache, /fetchAmadeusAccessToken/);
    assert.match(caller, /executeAmadeusCorporateGroupSearch/);
    assert.match(caller, /mapGroupRequestToAmadeusPayload/);
    assert.match(caller, /\/v2\/shopping\/flight-offers/);
    assert.match(route, /requireOwnerUser/);
    assert.match(route, /getTravelGroupRequestById/);
    assert.match(repo, /getTravelGroupRequestById/);
    assert.doesNotMatch(caller, /USE_MOCK|fake success/i);
  });

  it("ships operator smoke CLI gated by OPERATOR_SMOKE_ENABLED", () => {
    const smoke = read("lib/travel/corporate/tax-exempt-operator-smoke.ts");
    const cli = read("scripts/smoke/tax-exempt-operator-smoke.mjs");
    const runbook = read("docs/TAX_EXEMPT_CLOUD_RUNBOOK.md");

    assert.match(smoke, /OPERATOR_SMOKE_ENABLED/);
    assert.match(smoke, /reviewChurchTaxProfile/);
    assert.match(cli, /list-pending/);
    assert.match(runbook, /tax-exempt-certificates/);
    assert.match(runbook, /service_role/);
  });
});
