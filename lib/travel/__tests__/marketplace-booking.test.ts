import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

describe("marketplace booking handoff", () => {
  it("persists booking attempts with truthful statuses", () => {
    const sql = read("supabase/migrations/20260810163000_travel_marketplace_booking_attempts.sql");
    assert.match(sql, /travel_marketplace_booking_attempts/);
    assert.match(sql, /booking_started/);
    assert.match(sql, /pending_confirmation/);
    assert.match(sql, /confirmed/);
    assert.match(sql, /canceled/);
    assert.match(sql, /failed/);
    assert.match(sql, /status <> 'confirmed' or confirmation_number is not null/);
    assert.match(sql, /auth\.uid\(\) = user_id/);
    assert.match(sql, /marketplace/);
  });

  it("starts partner handoff without confirming", () => {
    const start = read("app/api/travel/marketplace/booking/start/route.ts");
    const booking = read("lib/travel/marketplace/booking.ts");
    assert.match(start, /getUserFromSession/);
    assert.match(start, /createMarketplaceBookingAttempt/);
    assert.match(booking, /return_path:\s*"\/travel\/trip",\s*status:\s*"booking_started"/);
    assert.match(booking, /travel_booking_redirected/);
    assert.doesNotMatch(start, /status:\s*"confirmed"|confirmation_number/);
  });

  it("return/reconcile never confirms from redirect alone", () => {
    const ret = read("app/api/travel/marketplace/booking/return/route.ts");
    const page = read("app/travel/marketplace/return/page.tsx");
    const booking = read("lib/travel/marketplace/booking.ts");
    assert.match(ret, /pending_confirmation|markMarketplaceAttemptReturned/);
    assert.match(ret, /confirmed:\s*attempt\.status === "confirmed"/);
    assert.match(ret, /Partner redirect cannot force booking confirmation/);
    assert.match(page, /markMarketplaceAttemptReturned/);
    assert.match(page, /marketplace=pending/);
    assert.match(booking, /pending_confirmation/);
    assert.doesNotMatch(page, /status:\s*"confirmed"|confirmation_number/);
  });

  it("confirm requires real confirmation and writes My Trip domain", () => {
    const confirm = read("app/api/travel/marketplace/booking/confirm/route.ts");
    const booking = read("lib/travel/marketplace/booking.ts");
    assert.match(confirm, /confirmMarketplaceAttempt/);
    assert.match(booking, /A real confirmation or booking reference is required/);
    assert.match(booking, /travel_hotel_reservations/);
    assert.match(booking, /user_trip_flights/);
    assert.match(booking, /user_trip_cars/);
    assert.match(booking, /booking_source:\s*"marketplace"/);
  });

  it("UI starts booking through server handoff and My Trip shows pending", () => {
    assert.match(read("components/travel/MarketplaceOfferActions.tsx"), /\/api\/travel\/marketplace\/booking\/start/);
    assert.match(read("components/travel/MarketplaceHotelSearch.tsx"), /MarketplaceOfferActions/);
    assert.match(read("components/travel/FlightSearchPanel.tsx"), /MarketplaceOfferActions/);
    assert.match(read("components/travel/RentalCarSearchPanel.tsx"), /MarketplaceOfferActions/);
    assert.match(read("components/travel/MyTripClient.tsx"), /marketplace\/booking\/attempts/);
    assert.match(read("components/travel/MyTripClient.tsx"), /pending confirmation/i);
    assert.match(read("components/travel/MyTripClient.tsx"), /redirect never confirms/i);
  });

  it("owner can monitor marketplace attempts without secrets", () => {
    const ownerApi = read("app/api/owner/travel/route.ts");
    const ownerUi = read("components/owner/TravelManagementClient.tsx");
    assert.match(ownerApi, /listOwnerMarketplaceAttempts/);
    assert.match(ownerApi, /marketplaceQueues/);
    assert.match(ownerApi, /marketplaceReadiness/);
    assert.match(ownerApi, /stale_pending_review|marketplaceExceptionQueues/);
    assert.match(ownerApi, /••••/);
    assert.doesNotMatch(ownerApi, /EXPEDIA_RAPID_API_SECRET|DUFFEL_ACCESS_TOKEN|AMADEUS_API_SECRET/);
    assert.doesNotMatch(ownerApi, /offer_snapshot/);
    assert.match(ownerUi, /Marketplace booking attempts/);
    assert.match(ownerUi, /Provider readiness diagnostics/);
    assert.match(ownerUi, /Stale \/ pending review/);
    assert.match(ownerUi, /Provider API keys and tokens are never shown/);
  });

  it("distinguishes provider not configured from zero results", () => {
    const search = read("lib/travel/marketplace/search.ts");
    const hotelsUi = read("components/travel/MarketplaceHotelSearch.tsx");
    const outcome = read("components/travel/MarketplaceSearchOutcome.tsx");
    assert.match(search, /provider_not_configured/);
    assert.match(search, /zero_results/);
    assert.match(search, /provider_unavailable/);
    assert.match(outcome, /Live marketplace inventory is temporarily unavailable/);
    assert.match(outcome, /No matching marketplace offers/);
    assert.match(outcome, /Browse official COGIC negotiated hotels/);
    assert.match(hotelsUi, /MarketplaceSearchOutcome/);
    assert.match(hotelsUi, /showOfficialHotelsLink/);
  });

  it("enforces ownership and blocks client-forced confirmation", () => {
    const confirm = read("app/api/travel/marketplace/booking/confirm/route.ts");
    const recheck = read("app/api/travel/marketplace/booking/recheck/route.ts");
    const attempts = read("app/api/travel/marketplace/booking/attempts/route.ts");
    const booking = read("lib/travel/marketplace/booking.ts");
    assert.match(confirm, /getUserFromSession/);
    assert.match(confirm, /Client cannot force booking confirmation status/);
    assert.match(recheck, /recheckMarketplaceAttempt/);
    assert.match(recheck, /Client cannot force booking confirmation status/);
    assert.match(attempts, /eq\("user_id"|getUserFromSession|user\.id/);
    assert.match(booking, /assertMarketplaceTransition/);
    assert.match(booking, /isStaleMarketplaceAttempt/);
    assert.match(booking, /\.eq\("user_id", userId\)|\.eq\("user_id", input\.userId\)/);
  });

  it("My Trip keeps pending distinct from confirmed and supports recheck", () => {
    const trip = read("components/travel/MyTripClient.tsx");
    assert.match(trip, /pending confirmation is not booked/i);
    assert.match(trip, /Check booking status/);
    assert.match(trip, /marketplace\/booking\/recheck/);
    assert.match(trip, /canceled or failed/i);
    assert.doesNotMatch(trip, /API_KEY|ACCESS_TOKEN|API_SECRET/);
  });

  it("legacy my-convocation travel lands on My Trip", () => {
    assert.match(read("app/my-convocation/travel/page.tsx"), /redirect\("\/travel\/trip"\)/);
  });

  it("documents required marketplace credentials and intentional disablement", () => {
    const env = read("env.travel.example");
    assert.match(env, /EXPEDIA_RAPID_API_KEY=/);
    assert.match(env, /EXPEDIA_RAPID_API_SECRET=/);
    assert.match(env, /DUFFEL_ACCESS_TOKEN=/);
    assert.match(env, /AMADEUS_API_KEY=/);
    assert.match(env, /intentionally disable/i);
    assert.match(env, /Enterprise Amadeus/i);
    assert.doesNotMatch(env, /self-service portal onboarding|test api key/i);
  });

  it("provider status endpoint never returns secret material", () => {
    const status = read("app/api/travel/marketplace/status/route.ts");
    const credentials = read("lib/travel/marketplace/credentials.ts");
    assert.match(status, /marketplaceStatus/);
    assert.match(credentials, /import "server-only"/);
    assert.match(credentials, /not_configured/);
    assert.doesNotMatch(credentials, /process\.env\.[A-Z0-9_]+\s*,/);
    assert.match(credentials, /\[redacted\]/);
  });
});
