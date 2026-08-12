import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canShowRegistrationCheckoutResume,
  deriveRegistrationCheckoutResumeMode,
  registrationCheckoutResumeCopy,
} from "@/lib/registration/checkout-resume";

describe("registration checkout resume strategy", () => {
  it("maps submitted to first checkout", () => {
    assert.equal(
      deriveRegistrationCheckoutResumeMode({
        groupStatus: "submitted",
        paymentStatus: null,
      }),
      "awaiting_first_checkout",
    );
  });

  it("maps payment_pending + pending payment to pending_session resume", () => {
    assert.equal(
      deriveRegistrationCheckoutResumeMode({
        groupStatus: "payment_pending",
        paymentStatus: "pending",
      }),
      "pending_session",
    );
    assert.equal(canShowRegistrationCheckoutResume("pending_session"), true);
    assert.match(
      registrationCheckoutResumeCopy("pending_session") ?? "",
      /existing session/i,
    );
  });

  it("maps payment_pending without pending payment to stale_replace", () => {
    assert.equal(
      deriveRegistrationCheckoutResumeMode({
        groupStatus: "payment_pending",
        paymentStatus: "canceled",
      }),
      "stale_replace",
    );
    assert.equal(
      deriveRegistrationCheckoutResumeMode({
        groupStatus: "payment_pending",
        paymentStatus: null,
      }),
      "stale_replace",
    );
    assert.match(
      registrationCheckoutResumeCopy("stale_replace") ?? "",
      /replacement Stripe Session/i,
    );
  });

  it("hides resume while webhook / ledger sync is in progress", () => {
    assert.equal(
      deriveRegistrationCheckoutResumeMode({
        groupStatus: "payment_pending",
        paymentStatus: "pending",
        paymentComplete: true,
      }),
      "webhook_processing",
    );
    assert.equal(
      deriveRegistrationCheckoutResumeMode({
        groupStatus: "payment_pending",
        paymentStatus: "paid",
      }),
      "webhook_processing",
    );
    assert.equal(canShowRegistrationCheckoutResume("webhook_processing"), false);
    assert.match(
      registrationCheckoutResumeCopy("webhook_processing") ?? "",
      /do not start another checkout/i,
    );
  });

  it("ignores draft and confirmed for resume controls", () => {
    assert.equal(
      deriveRegistrationCheckoutResumeMode({
        groupStatus: "draft",
        paymentStatus: null,
      }),
      "not_applicable",
    );
    assert.equal(
      deriveRegistrationCheckoutResumeMode({
        groupStatus: "confirmed",
        paymentStatus: "paid",
      }),
      "not_applicable",
    );
  });
});
