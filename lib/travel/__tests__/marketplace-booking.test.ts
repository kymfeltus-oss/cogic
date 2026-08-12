import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

describe("marketplace booking handoff", () => {
  it("persists booking attempts with truthful statuses", () => {
    const legacy = read("supabase/migrations/20260810163000_travel_marketplace_booking_attempts.sql");
    const transactional = read("supabase/migrations/20260811000000_travel_transactional_core.sql");
    assert.match(legacy, /travel_marketplace_booking_attempts/);
    assert.match(legacy, /auth\.uid\(\) = user_id/);
    assert.match(transactional, /travel_transaction_status/);
    assert.match(transactional, /DRAFT/);
    assert.match(transactional, /PAYMENT_PENDING/);
    assert.match(transactional, /SUPPLIER_SUBMITTED/);
    assert.match(transactional, /CONFIRMED/);
    assert.match(transactional, /supplier_confirmation_number/);
    assert.match(transactional, /payment_intent_id/);
  });

  it("partner handoff start and return APIs are deleted; soft landing goes to in-app checkout", () => {
    const page = read("app/travel/marketplace/return/page.tsx");
    const booking = read("lib/travel/marketplace/booking.ts");
    assert.equal(
      fs.existsSync(path.join(root, "app/api/travel/marketplace/booking/start/route.ts")),
      false,
    );
    assert.equal(
      fs.existsSync(path.join(root, "app/api/travel/marketplace/booking/return/route.ts")),
      false,
    );
    assert.match(page, /\/travel\/checkout\/continue\?attemptId=/);
    assert.match(page, /redirect\("\/travel"\)/);
    assert.doesNotMatch(
      booking,
      /createMarketplaceBookingAttempt|markMarketplaceAttemptReturned|confirmMarketplaceAttempt|recheckMarketplaceAttempt/,
    );
  });

  it("manual confirm and recheck routes are retired", () => {
    const confirm = read("app/api/travel/marketplace/booking/confirm/route.ts");
    const recheck = read("app/api/travel/marketplace/booking/recheck/route.ts");
    const booking = read("lib/travel/marketplace/booking.ts");
    const fulfill = read("lib/travel/checkout/fulfill.ts");
    assert.match(confirm, /QUARANTINED|RETIRED/);
    assert.match(confirm, /410/);
    assert.match(confirm, /manual_confirm_retired|Manual marketplace confirmation is retired/);
    assert.match(recheck, /410/);
    assert.match(recheck, /recheck_retired|Marketplace recheck is retired/);
    assert.doesNotMatch(confirm, /confirmMarketplaceAttempt/);
    assert.doesNotMatch(booking, /confirmMarketplaceAttempt|recheckMarketplaceAttempt/);
    assert.match(fulfill, /bookMarketplaceSupplier|fulfillPaidTravelCheckout/);
    assert.doesNotMatch(fulfill, /confirmMarketplaceAttempt/);
  });

  it("UI starts in-app checkout and My Trip tracks transactional status", () => {
    assert.match(read("components/travel/MarketplaceOfferActions.tsx"), /\/travel\/checkout\//);
    assert.match(read("components/travel/MarketplaceOfferActions.tsx"), /stashTravelCheckoutOffer/);
    assert.doesNotMatch(read("components/travel/MarketplaceOfferActions.tsx"), /window\.open|booking\/start/);
    assert.match(read("components/travel/HotelSearchClient.tsx"), /MarketplaceOfferActions/);
    assert.match(read("components/travel/FlightSearchPanel.tsx"), /MarketplaceOfferActions/);
    assert.match(read("components/travel/RentalCarSearchPanel.tsx"), /MarketplaceOfferActions/);
    assert.match(read("components/travel/MyTripClient.tsx"), /marketplace\/booking\/attempts/);
    assert.match(read("components/travel/MyTripClient.tsx"), /Continue secure checkout/);
    assert.match(read("components/travel/MyTripClient.tsx"), /\/travel\/checkout\/continue\?attemptId=/);
    assert.doesNotMatch(
      read("components/travel/MyTripClient.tsx"),
      /Add confirmation|Reopen partner booking|Add My Reservation|confirmationNumber|Confirmation number/,
    );
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
    assert.match(ownerUi, /TRANSACTIONAL LEDGER|OPERATIONS LEDGER|Marketplace booking attempts/);
    assert.match(ownerUi, /Provider readiness diagnostics/);
    assert.match(ownerUi, /In-app checkout fulfillment ready|checkoutFulfillmentOperational/);
    assert.match(ownerUi, /Stale open|Stale \/ pending review/);
    assert.match(ownerUi, /Provider API keys and tokens are never shown/);
    assert.match(ownerUi, /Query live supplier status|Execute Stripe reversal/);
    assert.doesNotMatch(ownerUi, /Booking handoff operational|bookingHandoffOperational|Mark verified/);
    assert.match(ownerApi, /owner_verify_retired|Owner verify\/confirm is retired/);
    assert.match(ownerApi, /checkoutFulfillmentOperational/);
    assert.doesNotMatch(ownerApi, /bookingHandoffOperational/);
  });

  it("distinguishes provider not configured from zero results", () => {
    const search = read("lib/travel/marketplace/search.ts");
    const hotelsUi = read("components/travel/HotelSearchClient.tsx");
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

  it("enforces ownership on attempts and retires client confirmation authority", () => {
    const confirm = read("app/api/travel/marketplace/booking/confirm/route.ts");
    const recheck = read("app/api/travel/marketplace/booking/recheck/route.ts");
    const attempts = read("app/api/travel/marketplace/booking/attempts/route.ts");
    const booking = read("lib/travel/marketplace/booking.ts");
    assert.match(confirm, /410/);
    assert.match(recheck, /410/);
    assert.match(attempts, /eq\("user_id"|getUserFromSession|user\.id/);
    assert.match(booking, /assertMarketplaceTransition/);
    assert.match(booking, /isStaleMarketplaceAttempt/);
    assert.match(booking, /\.eq\("user_id", userId\)|\.eq\("user_id", input\.userId\)/);
  });

  it("My Trip keeps open checkout distinct from failed/refunded attempts", () => {
    const trip = read("components/travel/MyTripClient.tsx");
    assert.match(trip, /Marketplace checkout in progress/);
    assert.match(trip, /failed or refunded/i);
    assert.doesNotMatch(trip, /marketplace\/booking\/recheck|Add confirmation/);
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
    assert.match(env, /Enterprise Amadeus|Amadeus diagnostics/i);
    assert.match(env, /Smoke Test Checklist|OPERATOR RUNBOOK|smoke checklist/i);
    assert.match(env, /checkout\/continue\?attemptId/);
    assert.match(env, /checkout_type=travel_marketplace/);
    assert.match(env, /partner-point-of-sale|EXPEDIA_RAPID_PARTNER_POS/);
    assert.match(env, /payment_intent\.succeeded/);
    assert.match(env, /EXPEDIA_RAPID_API_KEY=/);
    assert.match(env, /DUFFEL_ACCESS_TOKEN=/);
    assert.match(env, /TRAVEL_SUPPLIER_WEBHOOK_SECRET=/);
    assert.match(env, /Smoke Test Checklist/);
    assert.match(env, /booking\/\{confirm,recheck\}|booking\/start and booking\/return API directories are absent/);
    assert.doesNotMatch(env, /self-service portal onboarding|test api key/i);
  });

  it("marketplace search only uses fulfillment-capable providers", () => {
    const credentials = read("lib/travel/marketplace/credentials.ts");
    const search = read("lib/travel/marketplace/search.ts");
    assert.match(credentials, /fulfillment-capable|Expedia Rapid/);
    assert.match(credentials, /marketplaceHotelProvider[\s\S]*expedia-rapid[\s\S]*return null/);
    assert.match(credentials, /marketplaceFlightProvider[\s\S]*duffel[\s\S]*return null/);
    assert.doesNotMatch(search, /searchAmadeusHotels|searchAmadeusFlights|searchAmadeusCars/);
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
