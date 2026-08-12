import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { createCipheriv, createHmac, scryptSync } from "crypto";
import {
  decryptSupplierWebhookPayload,
  normalizeSupplierWebhookPayload,
  verifySupplierWebhookSignature,
} from "../ops/supplier-webhook-parse";

const root = process.cwd();
const read = (filePath: string) => fs.readFileSync(path.join(root, filePath), "utf8");

describe("travel operations ledger + supplier webhooks", () => {
  it("owner UI exposes ledger filters and live override actions", () => {
    const ui = read("components/owner/TravelManagementClient.tsx");
    const ops = read("app/api/owner/travel/ops/route.ts");
    const owner = read("app/api/owner/travel/route.ts");
    const ledger = read("lib/travel/ops/ledger.ts");
    assert.match(ui, /TRANSACTIONAL LEDGER/);
    assert.match(ui, /FAILED/);
    assert.match(ui, /PAYMENT_PENDING/);
    assert.match(ui, /CONFIRMED/);
    assert.match(ui, /DRAFT/);
    assert.match(ui, /SUPPLIER_SUBMITTED/);
    assert.match(ui, /REFUNDED/);
    assert.match(ui, /marketplaceUserId|User account id/);
    assert.match(ui, /Expedia/);
    assert.match(ui, /Duffel/);
    assert.match(ui, /Min checkout|marketplaceAmountMinCents|amountMinDollars/);
    assert.match(ui, /Query live supplier status/);
    assert.match(ui, /Execute Stripe reversal/);
    assert.match(ui, /Save override to transactional ledger|Log override/);
    assert.match(ui, /travel_booking_transactions/);
    assert.match(ui, /travel_booking_transaction_events/);
    assert.match(ui, /Save inventory date range/);
    assert.match(ui, /\/api\/owner\/travel\/ops/);
    assert.match(ui, /owner-override-form/);
    assert.doesNotMatch(ui, /Mark verified/);
    assert.match(ops, /requireOwnerUser/);
    assert.match(ops, /sync_supplier_status/);
    assert.match(ops, /refund_stripe/);
    assert.match(ops, /inventory_dates/);
    assert.match(ops, /log_override/);
    assert.match(owner, /marketplaceSort/);
    assert.match(owner, /marketplaceUserId/);
    assert.match(owner, /marketplaceAmountMinCents/);
    assert.match(owner, /listOwnerMarketplaceAttempts/);
    assert.match(owner, /listOwnerBookingTransactions/);
    assert.match(owner, /bookingTransactions/);
    assert.match(owner, /transactionEvents/);
    assert.match(ledger, /logOwnerTransactionOverride/);
    assert.doesNotMatch(ops, /EXPEDIA_RAPID_API_SECRET|DUFFEL_ACCESS_TOKEN/);
    assert.doesNotMatch(ui, /sample booking|demo ledger|fake attempt/i);
  });

  it("supplier webhook verifies HMAC and normalizes Expedia/Duffel payloads", () => {
    const prev = process.env.TRAVEL_SUPPLIER_WEBHOOK_SECRET;
    process.env.TRAVEL_SUPPLIER_WEBHOOK_SECRET = "test-secret";
    const body = JSON.stringify({
      provider: "duffel",
      eventType: "flight_time_change",
      providerEventId: "evt_1",
      confirmationNumber: "ABC123",
      changes: { departureAt: "2026-11-03T10:00:00Z" },
      summary: "Departure moved",
    });
    const sig = createHmac("sha256", "test-secret").update(body).digest("hex");
    assert.equal(verifySupplierWebhookSignature(body, sig).ok, true);
    assert.equal(verifySupplierWebhookSignature(body, "bad").ok, false);
    const normalized = normalizeSupplierWebhookPayload(JSON.parse(body));
    assert.equal(normalized?.providerKey, "duffel");
    assert.equal(normalized?.eventType, "flight_time_change");
    assert.equal(normalized?.confirmationNumber, "ABC123");

    const expedia = normalizeSupplierWebhookPayload({
      event_id: "e1",
      itinerary_id: "itin-9",
      event_type: "itinerary.cancelled",
      status: "canceled",
    });
    assert.equal(expedia?.providerKey, "expedia-rapid");
    assert.equal(expedia?.eventType, "cancellation");
    process.env.TRAVEL_SUPPLIER_WEBHOOK_SECRET = prev;
  });

  it("decrypts optional AES-GCM supplier envelopes", () => {
    const prev = process.env.TRAVEL_SUPPLIER_WEBHOOK_SECRET;
    process.env.TRAVEL_SUPPLIER_WEBHOOK_SECRET = "test-secret";
    const plaintext = JSON.stringify({
      provider: "expedia",
      eventType: "room_reassignment",
      confirmationNumber: "ROOM99",
      summary: "Room moved",
      changes: { roomName: "King Suite" },
    });
    const key = scryptSync("test-secret", "cogic-travel-supplier-webhook", 32);
    const iv = Buffer.alloc(12, 7);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const envelope = JSON.stringify({
      encrypted: true,
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      ciphertext: encrypted.toString("base64"),
    });
    const decrypted = decryptSupplierWebhookPayload(envelope);
    assert.equal(decrypted.ok, true);
    if (decrypted.ok) {
      const normalized = normalizeSupplierWebhookPayload(JSON.parse(decrypted.plaintext));
      assert.equal(normalized?.providerKey, "expedia-rapid");
      assert.equal(normalized?.changes.roomName, "King Suite");
    }
    process.env.TRAVEL_SUPPLIER_WEBHOOK_SECRET = prev;
  });

  it("wires webhook route and My Trip supplier update ledger", () => {
    const route = read("app/api/travel/webhooks/supplier/route.ts");
    const apply = read("lib/travel/ops/supplier-webhook.ts");
    const trip = read("components/travel/MyTripClient.tsx");
    const updates = read("app/api/travel/supplier-updates/route.ts");
    const migration = read("supabase/migrations/20260811140000_travel_ops_supplier_events.sql");
    assert.match(route, /verifySupplierWebhookSignature/);
    assert.match(route, /decryptSupplierWebhookPayload/);
    assert.match(route, /applySupplierWebhookEvent/);
    assert.match(apply, /travel_booking_transaction_events/);
    assert.match(apply, /supplier_webhook_/);
    assert.match(apply, /resolveAttempt|marketplaceAttemptId/);
    assert.match(updates, /listUserSupplierChangeEvents/);
    assert.match(trip, /\/api\/travel\/supplier-updates/);
    assert.match(trip, /Supplier updates/);
    assert.match(migration, /travel_supplier_change_events/);
  });

  it("keeps marketplace booking owner contract strings aligned", () => {
    const ui = read("components/owner/TravelManagementClient.tsx");
    assert.match(ui, /Provider readiness diagnostics/);
    assert.match(ui, /Provider API keys and tokens are never shown/);
    assert.match(ui, /Stale open/);
  });
});
