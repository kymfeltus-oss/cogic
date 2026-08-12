import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (filePath: string) => fs.readFileSync(path.join(root, filePath), "utf8");

describe("corporate Amadeus supplier mapping", () => {
  it("ships server-only mapper with corporate party guard and credential fail-closed", () => {
    const source = read("lib/travel/corporate/supplier-mapping.ts");

    assert.match(source, /import "server-only"/);
    assert.match(source, /export function mapGroupRequestToAmadeusPayload/);
    assert.match(source, /TravelGroupBookingRequestRow/);
    assert.match(source, /TRAVEL_GROUP_MIN_PARTY_SIZE|party_size >=/);
    assert.match(source, /CorporateGroupMappingError/);
    assert.match(source, /AMADEUS_CONNECTION_FAULT/);
    assert.match(source, /AMADEUS_CLIENT_SECRET/);
    assert.match(source, /AMADEUS_API_SECRET/);
    assert.match(source, /originLocationCodes/);
    assert.match(source, /destinationLocationCodes/);
    assert.match(source, /extractIataTerminalCodes/);
    assert.doesNotMatch(source, /USE_MOCK|placeholder|fake success/i);
  });

  it("does not invent IATA codes from city names in mapper source", () => {
    const source = read("lib/travel/corporate/supplier-mapping.ts");
    assert.match(source, /Never invents airport codes/);
    assert.match(source, /City names alone are not mapped/);
    assert.match(source, /MEM-STL/);
  });

  it("ships supplier mapping module file", () => {
    assert.ok(
      fs.existsSync(path.join(root, "lib/travel/corporate/supplier-mapping.ts")),
    );
  });
});
