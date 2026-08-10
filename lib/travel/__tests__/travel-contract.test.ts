import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (filePath: string) => fs.readFileSync(path.join(root, filePath), "utf8");

describe("COGIC Travel phase contract", () => {
  it("shows only published non-archived hotels", () => {
    const source = read("lib/travel/repository.ts");
    assert.match(source, /eq\("published",true\)/);
    assert.match(source, /eq\("archived",false\)/);
  });

  it("keeps provider credentials on the server and gives an honest unavailable state", () => {
    assert.match(read("lib/travel/providers.ts"), /import "server-only"/);
    assert.doesNotMatch(read("components/travel/TravelShell.tsx"), /fake|sample rate|demo inventory/i);
    assert.match(read("components/travel/TravelShell.tsx"), /never show invented prices or availability/i);
  });

  it("integrates registration with optional travel", () => {
    const source =
      read("components/registration/RegistrationGroupStatus.tsx") +
      read("components/registration/RegistrationSlice2Experience.tsx");
    assert.match(source, /Plan My Trip/);
    assert.match(source, /Go to My Convocation/);
  });

  it("implements owner-scoped CRUD and program isolation", () => {
    const api = read("app/api/travel/itinerary/route.ts");
    const migration = read("supabase/migrations/20260807150000_cogic_travel_foundation.sql");
    assert.match(api, /\.eq\("user_id",u\.id\)/);
    assert.match(api, /TRAVEL_PROGRAM_KEY/);
    assert.match(migration, /auth\.uid\(\)=user_id/g);
    assert.match(migration, /cogic-stream-2026/);
  });

  it("does not expose provider secrets to client code", () => {
    const client =
      read("components/owner/TravelManagementClient.tsx") +
      read("components/travel/MyTripClient.tsx");
    assert.doesNotMatch(client, /EXPEDIA_RAPID_API_KEY|DUFFEL_ACCESS_TOKEN|AMADEUS_API_SECRET|process\.env\./i);
  });

  it("defines all required analytics events", () => {
    const api = read("app/api/travel/analytics/route.ts");
    for (const event of [
      "travel_page_viewed",
      "official_hotel_clicked",
      "travel_flight_search_started",
      "travel_car_search_started",
      "travel_itinerary_added",
      "travel_booking_redirected",
    ]) {
      assert.match(api, new RegExp(event));
    }
  });
});
