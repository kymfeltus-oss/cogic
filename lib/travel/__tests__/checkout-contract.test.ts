import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

describe("travel transactional checkout", () => {
  it("exposes create-intent and complete-booking routes with server authority", () => {
    const createIntent = read("app/api/travel/checkout/create-intent/route.ts");
    const complete = read("app/api/travel/checkout/complete-booking/route.ts");
    assert.match(createIntent, /resolveAuthenticatedBuyer/);
    assert.match(createIntent, /createTravelCheckoutIntent/);
    assert.match(createIntent, /evaluateCheckoutAuthorityGate/);
    assert.match(createIntent, /itemization/);
    assert.match(createIntent, /draftStatus:\s*"DRAFT"/);
    assert.match(createIntent, /paymentGateStatus:\s*"PAYMENT_PENDING"/);
    assert.match(complete, /fulfillPaidTravelCheckout/);
    assert.match(complete, /supplier_confirmation_number|Client cannot force/);
    assert.match(complete, /paymentIntentId is required/);
    assert.match(complete, /supplierFailed:\s*true/);
    assert.match(complete, /refundExecuted/);
  });

  it("creates DRAFT attempts and Stripe PaymentIntents with travel metadata", () => {
    const create = read("lib/travel/checkout/create-intent.ts");
    const repo = read("lib/travel/checkout/repository.ts");
    const stripe = read("lib/travel/checkout/stripe.ts");
    assert.match(create, /insertDraftCheckoutAttempt/);
    assert.match(create, /upsertCheckoutLedger/);
    assert.match(create, /status:\s*"DRAFT"/);
    assert.match(create, /markAttemptPaymentPending/);
    assert.match(repo, /status:\s*"DRAFT"/);
    assert.match(create, /marketplaceUnavailableReason|expediaRapidConfigured|duffelConfigured/);
    assert.match(create, /getDuffelOffer/);
    assert.match(create, /priceCheckExpediaHotel/);
    assert.match(create, /priceCheckExpediaCar/);
    assert.match(create, /expedia_hotel_price_check|expedia_car_price_check/);
    assert.match(create, /buildTrustedSnapshot/);
    assert.doesNotMatch(create, /\.\.\.offer/);
    assert.doesNotMatch(create, /provider_offer_snapshot/);
    assert.match(create, /travelServiceFeeCents/);
    assert.match(stripe, /paymentIntents\.create/);
    assert.match(stripe, /checkout_type:\s*"travel_marketplace"/);
    assert.match(stripe, /attempt_id/);
    assert.match(stripe, /refunds\.create/);
  });

  it("resumes checkout by attempt_id without sessionStorage", () => {
    const resume = read("lib/travel/checkout/resume.ts");
    const route = read("app/api/travel/checkout/resume/route.ts");
    const repo = read("lib/travel/checkout/repository.ts");
    const page = read("app/travel/checkout/continue/page.tsx");
    const client = read("components/travel/checkout/TravelCheckoutClient.tsx");
    const summary = read("components/travel/checkout/CheckoutSummaryCard.tsx");
    const trip = read("components/travel/MyTripClient.tsx");
    assert.match(resume, /resumeTravelCheckoutAttempt/);
    assert.match(resume, /retrieveTravelPaymentIntent/);
    assert.match(resume, /createTravelCheckoutIntent/);
    assert.match(resume, /retireSupersededCheckoutAttempt/);
    assert.match(resume, /retireOpenDuplicateCheckoutAttempts/);
    assert.match(
      resume,
      /paymentIntent\.client_secret[\s\S]*retireOpenDuplicateCheckoutAttempts\([\s\S]*exceptAttemptId:\s*attempt\.id/,
    );
    assert.match(resume, /missing a live bookToken|bookToken/);
    assert.match(repo, /retireSupersededCheckoutAttempt/);
    assert.match(repo, /retireOpenDuplicateCheckoutAttempts/);
    assert.match(repo, /neq\("id", exceptAttemptId\)|\.neq\("id"/);
    assert.match(route, /resolveAuthenticatedBuyer/);
    assert.match(route, /resumeTravelCheckoutAttempt/);
    assert.match(route, /evaluateCheckoutAuthorityGate/);
    const authorityResume = read("lib/travel/checkout/client-authority.ts");
    assert.match(authorityResume, /attemptId is required/);
    assert.match(authorityResume, /offer snapshot|charged amounts/);
    assert.match(page, /resumeOnly/);
    assert.match(page, /Loading your pending PaymentIntent/);
    assert.match(client, /\/api\/travel\/checkout\/resume/);
    assert.match(client, /resumeOnly|attemptIdParam/);
    assert.match(client, /hydratedResumeAttemptRef/);
    assert.match(client, /Missing checkout attempt/);
    assert.match(client, /router\.replace/);
    assert.match(client, /moneyFromServerPayload|itemization/);
    assert.match(
      client,
      /useResume \? "\/api\/travel\/checkout\/resume"[\s\S]*\? \{ attemptId: attemptIdParam \}/,
    );
    assert.match(client, /if \(useResume\) \{[\s\S]*setStashed\(null\)/);
    assert.match(client, /const money = moneyFromServerPayload\(json\)/);
    assert.match(client, /showSummary = useResume[\s\S]*Boolean\(intent\)/);
    assert.match(summary, /fareCents:[\s\S]*totalAmountCents:[\s\S]*currency:/);
    assert.match(client, /displayFromResumePayload|never required for resumeOnly|session storage is not required/i);
    assert.match(client, /useResume \? \(intent\?\.fareCents|Resume: amounts only after server intent/);
    assert.match(read("app/travel/checkout/checkout.css"), /width:\s*min\(100%,\s*430px\)/);
    assert.match(read("app/travel/checkout/checkout.css"), /width:\s*min\(100%,\s*520px\)/);
    assert.match(trip, /\/travel\/checkout\/continue\?attemptId=/);
  });

  it("rejects client-trusted hotel/car totals at create-intent", () => {
    const createIntent = read("app/api/travel/checkout/create-intent/route.ts");
    const expedia = read("lib/travel/marketplace/expedia-rapid.ts");
    const create = read("lib/travel/checkout/create-intent.ts");
    const authority = read("lib/travel/checkout/client-authority.ts");
    assert.match(createIntent, /evaluateCheckoutAuthorityGate/);
    assert.match(authority, /Client cannot set user identity|charged amounts/);
    assert.match(expedia, /priceCheckExpediaHotel/);
    assert.match(expedia, /priceCheckExpediaCar/);
    assert.match(expedia, /rateToken !== bookToken/);
    assert.match(expedia, /Never match on bedGroup alone/);
    assert.match(create, /selectAuthoritativeFareCents|Never read money from the client offer|never used for Stripe/);
    assert.match(create, /assertExactBookTokenMatch|bookToken divergence detected/);
    assert.match(create, /never invent one from a composite offerId|missing a room package bookToken/);
    assert.match(authority, /selectAuthoritativeFareCents/);
    assert.match(authority, /evaluateCheckoutAuthorityGate/);
    assert.doesNotMatch(create, /provider_offer_snapshot_failed/);
  });

  it("fulfills paid intents via supplier book and refunds on supplier failure", () => {
    const fulfill = read("lib/travel/checkout/fulfill.ts");
    const supplier = read("lib/travel/checkout/supplier.ts");
    const webhook = read("app/api/webhooks/stripe/route.ts");
    assert.match(fulfill, /markAttemptSupplierSubmitted/);
    assert.match(fulfill, /bookMarketplaceSupplier/);
    assert.match(fulfill, /refundTravelPaymentIntent/);
    assert.match(fulfill, /markAttemptSupplierFailed/);
    assert.match(fulfill, /captureConfirmedAttempt/);
    assert.match(fulfill, /PaymentIntent is not succeeded/);
    assert.match(supplier, /bookExpediaHotel|bookExpediaCar|createDuffelOrder/);
    assert.match(webhook, /payment_intent\.succeeded/);
    assert.match(webhook, /fulfillPaidTravelCheckout/);
    assert.match(webhook, /TRAVEL_CHECKOUT_TYPE/);
  });

  it("persists supplier confirmation into transactional columns", () => {
    const repo = read("lib/travel/checkout/repository.ts");
    assert.match(repo, /supplier_confirmation_number/);
    assert.match(repo, /payment_intent_id/);
    assert.match(repo, /SUPPLIER_SUBMITTED/);
    assert.match(repo, /CONFIRMED/);
    assert.match(repo, /travel_booking_transactions/);
  });

  it("ships in-app Elements checkout and confirmation viewport", () => {
    const page = read("app/travel/checkout/[offerId]/page.tsx");
    const client = read("components/travel/checkout/TravelCheckoutClient.tsx");
    const confirmation = read("app/travel/confirmation/page.tsx");
    const confirmClient = read("components/travel/checkout/TravelConfirmationClient.tsx");
    const summary = read("components/travel/checkout/CheckoutSummaryCard.tsx");
    assert.match(page, /TravelCheckoutClient/);
    assert.match(page, /getStripePublishableKey/);
    assert.match(client, /PaymentElement|@stripe\/react-stripe-js/);
    assert.match(client, /SUPPLIER_SUBMITTED/);
    assert.match(client, /LOADING/);
    assert.match(client, /CONFIRMING/);
    assert.match(client, /ERROR/);
    assert.match(client, /tc-skeleton/);
    assert.match(client, /national provider network|Booking with the national provider/);
    assert.match(client, /create-intent/);
    assert.match(client, /complete-booking/);
    assert.match(client, /Try payment again/);
    assert.doesNotMatch(client, /window\.open|confirmation number/i);
    assert.match(summary, /Taxes & fees|Total due/);
    assert.match(summary, /Check-in|Room|Cabin|Pickup/);
    assert.match(confirmation, /TravelConfirmationClient/);
    assert.match(confirmClient, /Print receipt/);
    assert.match(confirmClient, /Download PDF Receipt/);
    assert.match(confirmClient, /Generating PDF/);
    assert.match(confirmClient, /handleDownloadReceipt/);
    assert.match(confirmClient, /isDownloading/);
    assert.match(confirmClient, /COGIC_Convocation_Receipt\.pdf/);
    assert.match(confirmClient, /transaction_id/);
    assert.match(confirmClient, /set\("format", "json"\)/);
    assert.match(confirmClient, /confirmationNumber/);
    assert.match(confirmClient, /\/api\/travel\/checkout\/receipt/);
    assert.match(confirmClient, /aria-busy/);
  });

  it("generates an authenticated PDF receipt from live booking tables", () => {
    const route = read("app/api/travel/checkout/receipt/route.ts");
    const pdf = read("lib/travel/checkout/receipt-pdf.ts");
    const data = read("lib/travel/checkout/receipt-data.ts");
    assert.match(route, /resolveAuthenticatedBuyer/);
    assert.match(route, /transaction_id/);
    assert.match(route, /Unauthorized asset access/);
    assert.match(route, /generateServerSidePdfBuffer/);
    assert.match(route, /travel_booking_transactions|loadTravelReceiptBundle/);
    assert.match(route, /user_id/);
    assert.match(route, /application\/pdf/);
    assert.match(route, /COGIC_Convocation_Receipt_/);
    assert.match(route, /Content-Length/);
    assert.match(data, /travel_booking_transactions/);
    assert.match(data, /travel_marketplace_booking_attempts|getCheckoutAttemptById/);
    assert.match(data, /total_amount_cents/);
    assert.match(data, /tax_amount_cents/);
    assert.match(data, /supplier_confirmation_number/);
    assert.match(pdf, /COGIC Holy Convocation Travel Hub Receipt/);
    assert.match(pdf, /EVENT TRAVEL PASS/);
    assert.match(pdf, /Base Fare|Tax Amount|Processing Fees/);
    assert.match(pdf, /pdf-lib|PDFDocument/);
    assert.match(pdf, /QRCode|qrcode|drawCode39Barcode/);
    assert.match(pdf, /formatCentsAsDollars|\$/);
    assert.doesNotMatch(route, /Buffer\.from\(\[\]\)/);
    assert.doesNotMatch(route, /createRouteHandlerClient/);
    assert.doesNotMatch(pdf, /lorem ipsum|placeholder pdf/i);
  });
});
