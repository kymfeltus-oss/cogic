import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  honestSubmittedCopy,
  isRegistrationEditable,
  pickDraftEditableFields,
  registrationReference,
  resolveRegistrationViewMode,
  shouldCreateNewDraft,
} from "@/lib/registration/workflow";
import type { Registration } from "@/lib/registration/types";

function baseRegistration(
  overrides: Partial<Registration> = {},
): Registration {
  return {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    programKey: "cogic-stream-2026",
    userId: "11111111-1111-1111-1111-111111111111",
    status: "draft",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    mobilePhone: "3125551212",
    streetAddress: "1 Main",
    city: "Chicago",
    state: "IL",
    postalCode: "60601",
    churchName: "Temple",
    pastorName: "Pastor",
    jurisdiction: "Illinois First",
    amountCents: null,
    currency: "usd",
    submittedAt: null,
    confirmedAt: null,
    canceledAt: null,
    refundedAt: null,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

describe("registration workflow", () => {
  it("only draft is editable", () => {
    assert.equal(isRegistrationEditable("draft"), true);
    assert.equal(isRegistrationEditable("submitted"), false);
    assert.equal(isRegistrationEditable("payment_pending"), false);
    assert.equal(isRegistrationEditable("confirmed"), false);
  });

  it("maps statuses to honest view modes", () => {
    assert.equal(resolveRegistrationViewMode(null), "wizard");
    assert.equal(resolveRegistrationViewMode(baseRegistration()), "wizard");
    assert.equal(
      resolveRegistrationViewMode(baseRegistration({ status: "submitted" })),
      "submitted",
    );
    assert.equal(
      resolveRegistrationViewMode(baseRegistration({ status: "canceled" })),
      "terminal",
    );
  });

  it("allows new draft after canceled/refunded only", () => {
    assert.equal(shouldCreateNewDraft(null), true);
    assert.equal(shouldCreateNewDraft("canceled"), true);
    assert.equal(shouldCreateNewDraft("refunded"), true);
    assert.equal(shouldCreateNewDraft("submitted"), false);
    assert.equal(shouldCreateNewDraft("confirmed"), false);
  });

  it("strips privileged identity fields from draft payloads", () => {
    const picked = pickDraftEditableFields({
      firstName: "Ada",
      userId: "forged",
      user_id: "forged",
      programKey: "other-program",
      program_key: "other-program",
      status: "confirmed",
      email: "ada@example.com",
    });
    assert.deepEqual(picked, {
      firstName: "Ada",
      email: "ada@example.com",
    });
    assert.equal("userId" in picked, false);
    assert.equal("programKey" in picked, false);
    assert.equal("status" in picked, false);
  });

  it("uses truthful submitted copy without QR or payment claims", () => {
    const copy = honestSubmittedCopy();
    assert.match(copy.title, /received/i);
    assert.doesNotMatch(copy.title, /you.?re registered/i);
    assert.doesNotMatch(copy.body, /payment|qr code|you're registered/i);
    assert.match(copy.body, /remaining registration requirements/i);
    assert.equal(copy.statusLabel, "Submitted");
    assert.equal(
      registrationReference(baseRegistration()),
      "AAAAAAAA",
    );
  });
});
