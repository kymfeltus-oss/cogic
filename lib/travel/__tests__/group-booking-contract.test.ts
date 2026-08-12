import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  isTravelGroupRequestValidationError,
  sanitizeTravelGroupRequestCreateInput,
} from "@/lib/travel/group-booking/validation";

const root = process.cwd();
const read = (filePath: string) => fs.readFileSync(path.join(root, filePath), "utf8");

describe("travel group booking requests", () => {
  it("rejects client-supplied church/requester/status fields", () => {
    const rejected = sanitizeTravelGroupRequestCreateInput({
      party_size: 12,
      travel_type: "hotel",
      destination: "St. Louis",
      departure_date: "2026-11-01",
      return_date: "2026-11-08",
      church_id: "spoof",
    });
    assert.equal(isTravelGroupRequestValidationError(rejected), true);
  });

  it("enforces party_size >= 10 and ordered dates", () => {
    const tooSmall = sanitizeTravelGroupRequestCreateInput({
      party_size: 9,
      travel_type: "hotel",
      destination: "St. Louis",
      departure_date: "2026-11-01",
      return_date: "2026-11-08",
    });
    assert.equal(isTravelGroupRequestValidationError(tooSmall), true);

    const badDates = sanitizeTravelGroupRequestCreateInput({
      party_size: 10,
      travel_type: "flight",
      destination: "St. Louis",
      departure_date: "2026-11-08",
      return_date: "2026-11-01",
    });
    assert.equal(isTravelGroupRequestValidationError(badDates), true);

    const ok = sanitizeTravelGroupRequestCreateInput({
      party_size: 10,
      travel_type: "multi",
      destination: "St. Louis",
      departure_date: "2026-11-01",
      return_date: "2026-11-08",
      notes: "Jurisdictional block",
    });
    assert.equal(isTravelGroupRequestValidationError(ok), false);
    if (!isTravelGroupRequestValidationError(ok)) {
      assert.equal(ok.partySize, 10);
      assert.equal(ok.travelType, "multi");
      assert.equal(ok.internalNotes, "Jurisdictional block");
    }
  });

  it("keeps group-request APIs server-authoritative", () => {
    const leader = read("app/api/travel/group-requests/route.ts");
    const owner = read("app/api/owner/travel/group-requests/route.ts");
    const orgMe = read("app/api/org/me/route.ts");
    const migration = read(
      "supabase/migrations/20260811000200_travel_group_booking_requests.sql",
    );

    assert.match(leader, /resolveServerOrgContext/);
    assert.match(leader, /status: 401/);
    assert.match(leader, /Pastor or Overseer/);
    assert.doesNotMatch(leader, /supabaseServiceRole/);
    assert.match(owner, /requireOwnerUser/);
    assert.match(owner, /updateTravelGroupRequestStatus/);
    assert.match(orgMe, /Authentication required/);
    assert.match(migration, /party_size >= 10/);
    assert.match(migration, /pending_quote/);
  });

  it("ships leader and owner UI surfaces", () => {
    assert.ok(fs.existsSync(path.join(root, "app/travel/group/page.tsx")));
    assert.ok(
      fs.existsSync(path.join(root, "components/travel/GroupBookingRequestClient.tsx")),
    );
    assert.match(
      read("components/travel/TravelGroupRequestsClient.tsx"),
      /GroupBookingRequestClient/,
    );
    assert.match(
      read("components/owner/TravelManagementClient.tsx"),
      /TravelGroupRequestsClient/,
    );
    assert.match(read("app/travel/page.tsx"), /\/travel\/group/);
    assert.doesNotMatch(
      read("components/travel/GroupBookingRequestClient.tsx"),
      /travel_type:\s*"both"/,
    );
    assert.match(
      read("components/travel/GroupBookingRequestClient.tsx"),
      /travel_type:\s*"multi"/,
    );
    const ownerClient = read("components/owner/TravelGroupRequestsClient.tsx");
    assert.match(ownerClient, /\/api\/owner\/travel\/group-requests/);
    assert.doesNotMatch(ownerClient, /450000/);
    assert.doesNotMatch(ownerClient, /fetch\("\/api\/travel\/group-requests"\)/);
    assert.match(
      read("app/api/owner/travel/group-requests/route.ts"),
      /allocated_quote_cents/,
    );
    assert.match(
      read("supabase/migrations/20260811000300_travel_group_booking_quote_cents.sql"),
      /allocated_quote_cents/,
    );
  });
});
