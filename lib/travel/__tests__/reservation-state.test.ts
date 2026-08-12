import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("hotel reservation state", () => {
  it("official booking start is DRAFT browse-and-request interest only", () => {
    const api = read("app/api/travel/hotel-booking/start/route.ts");
    assert.match(api, /status:\s*"DRAFT"/);
    assert.match(api, /browse_and_request|browse-and-request/);
    assert.match(api, /housing@cogic\.org/);
    assert.doesNotMatch(api, /payment_intent_id|paymentIntents\.create|status:\s*"CONFIRMED"/);
    assert.doesNotMatch(api, /confirmed_at|reservation_status:\s*"confirmed"/);
  });

  it("attendee-typed reservation POST is retired", () => {
    const api = read("app/api/travel/reservations/route.ts");
    assert.match(api, /attendee_manual_retired/);
    assert.match(api, /status:\s*410/);
    assert.match(api, /export async function PUT/);
    assert.match(api, /Typing a hotel confirmation number is retired/);
    assert.doesNotMatch(api, /booking_source:\s*"attendee_manual"/);
  });

  it("masks confirmations on attendee and dashboard summaries", () => {
    assert.match(read("components/travel/MyTripClient.tsx"), /••••/);
    assert.match(read("lib/travel/reservations.ts"), /••••/);
  });

  it("RLS isolates reservation and journey ownership", () => {
    const sql = read("supabase/migrations/20260807170000_travel_hotel_reservation_state.sql");
    assert.match(sql, /auth\.uid\(\)=user_id/g);
    assert.match(sql, /travel_reservation_audit_owner_read/);
    assert.match(sql, /one_primary_active_stay/);
  });

  it("canceled stays cannot remain primary", () => {
    const api = read("app/api/travel/reservations/route.ts");
    assert.match(api, /reservation_status:\s*"canceled"/);
    assert.match(api, /primary_stay:\s*false/);
  });

  it("suppresses shopping prompts after confirmation", () => {
    assert.match(read("app/travel/page.tsx"), /YOUR STAY IS SET/);
    assert.match(read("app/travel/hotels/[hotelId]/page.tsx"), /YOU&apos;RE STAYING HERE/);
    assert.match(read("components/travel/MyTripClient.tsx"), /••••|confirmed|primary/i);
  });

  it("official UI is browse-and-request, not in-app book/pay", () => {
    const ui = read("components/travel/HotelAvailabilityClient.tsx");
    const api = read("app/api/travel/hotel-booking/start/route.ts");
    assert.match(ui, /Save housing interest/);
    assert.match(ui, /Contact COGIC Housing/);
    assert.match(ui, /Interest Saved \/ Contacting Housing|Interest saved · Contacting Housing|browse_and_request/);
    assert.match(ui, /does not complete an in-app reservation|browse-and-request/);
    assert.match(ui, /json\.mode !== "browse_and_request"|mode !== "browse_and_request"/);
    assert.doesNotMatch(ui, /Continue hotel booking|window\.location\.href = json\.redirectTo/);
    assert.match(api, /mode:\s*"browse_and_request"/);
    assert.doesNotMatch(api, /redirectTo:\s*"\/travel\/trip"/);
    const trip = read("components/travel/MyTripClient.tsx");
    assert.match(trip, /marketplace checkouts and housing-completed registration stays/);
    assert.match(trip, /Official housing interest saved|browse-and-request/);
    assert.doesNotMatch(trip, /Continue hotel booking/);
  });

  it("admin can cancel but verify is retired", () => {
    const api = read("app/api/owner/travel/route.ts");
    const ops = read("app/api/owner/travel/ops/route.ts");
    assert.match(api, /action !== "cancel"/);
    assert.match(api, /owner_verify_retired|Owner verify\/confirm is retired/);
    assert.match(api, /retiredReservationActions|mark_verified/);
    assert.match(api, /status: 410/);
    assert.match(api, /travel_hotel_reservation_audit/);
    assert.doesNotMatch(api, /\["verify",\s*"cancel"\]/);
    assert.match(ops, /owner_verify_retired/);
    assert.match(ops, /sync_supplier_status/);
    assert.match(ops, /refund_stripe/);
    assert.match(ops, /log_override/);
    const ui = read("components/owner/TravelManagementClient.tsx");
    assert.match(ui, /Mark canceled/);
    assert.match(ui, /manual verify is retired|Owners may cancel only/);
    assert.match(ui, /does not verify, confirm, or change reservation status/);
    assert.doesNotMatch(ui, /Mark verified/);
    assert.match(ui, /reservation\(id: string, action: "cancel"\)|reservation\([^,]+,\s*"cancel"\)/);
  });

  it("analytics properties never contain confirmation numbers", () => {
    for (const p of [
      "app/api/travel/hotel-booking/start/route.ts",
      "app/api/travel/reservations/route.ts",
    ]) {
      const api = read(p);
      const propertyBlocks = api.match(/properties:\s*\{[\s\S]*?\}/g) ?? [];
      for (const block of propertyBlocks) assert.doesNotMatch(block, /confirmation/i);
    }
  });
});
