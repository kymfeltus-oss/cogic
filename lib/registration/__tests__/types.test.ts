import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACTIVE_REGISTRATION_STATUSES,
  DEFAULT_PROGRAM_KEY,
  mapRegistrationRow,
  REGISTRATION_CHECKOUT_TYPE,
  REGISTRATION_PAYMENT_STATUSES,
  REGISTRATION_STATUSES,
  sanitizeRegistrationPrimaryDraftInput,
  type RegistrationRow,
} from "@/lib/registration/types";

describe("registration types", () => {
  it("exports canonical statuses and program key", () => {
    assert.deepEqual([...REGISTRATION_STATUSES], [
      "draft",
      "submitted",
      "payment_pending",
      "confirmed",
      "canceled",
      "refunded",
    ]);
    assert.deepEqual([...ACTIVE_REGISTRATION_STATUSES], [
      "draft",
      "submitted",
      "payment_pending",
      "confirmed",
    ]);
    assert.deepEqual([...REGISTRATION_PAYMENT_STATUSES], [
      "pending",
      "paid",
      "failed",
      "canceled",
      "refunded",
    ]);
    assert.equal(DEFAULT_PROGRAM_KEY, "cogic-stream-2026");
    assert.equal(REGISTRATION_CHECKOUT_TYPE, "registration");
  });

  it("maps database rows to domain objects", () => {
    const row: RegistrationRow = {
      id: "11111111-1111-1111-1111-111111111111",
      program_key: "cogic-stream-2026",
      user_id: "22222222-2222-2222-2222-222222222222",
      status: "draft",
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
      mobile_phone: "3125551212",
      street_address: null,
      city: null,
      state: null,
      postal_code: null,
      church_name: null,
      pastor_name: null,
      jurisdiction: null,
      amount_cents: null,
      currency: "usd",
      submitted_at: null,
      confirmed_at: null,
      canceled_at: null,
      refunded_at: null,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
      created_by: null,
      updated_by: null,
    };

    const mapped = mapRegistrationRow(row);
    assert.equal(mapped.firstName, "Ada");
    assert.equal(mapped.programKey, "cogic-stream-2026");
    assert.equal(mapped.amountCents, null);
  });

  it("strips client price, status, and identity authority from the primary draft", () => {
    const sanitized = sanitizeRegistrationPrimaryDraftInput({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      price_cents: 0,
      amountCents: 0,
      status: "CONFIRMED",
      userId: "attacker-controlled-user",
      user_id: "attacker-controlled-user",
    });

    assert.equal(sanitized.firstName, "Ada");
    assert.equal(sanitized.lastName, "Lovelace");
    assert.equal(sanitized.email, "ada@example.com");
    assert.equal("price_cents" in sanitized, false);
    assert.equal("amountCents" in sanitized, false);
    assert.equal("status" in sanitized, false);
    assert.equal("userId" in sanitized, false);
    assert.equal("user_id" in sanitized, false);
  });
});
