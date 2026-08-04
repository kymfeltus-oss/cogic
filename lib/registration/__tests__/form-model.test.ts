import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY_REGISTRATION_FORM,
  REGISTRATION_FIELD_LABELS,
  registrationToFormValues,
  validateStep,
} from "@/lib/registration/form-model";
import type { Registration } from "@/lib/registration/types";

const complete: Registration = {
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
};

describe("registration form model", () => {
  it("allows incomplete drafts and maps persisted values", () => {
    const values = registrationToFormValues({
      ...complete,
      streetAddress: null,
      city: null,
    });
    assert.equal(values.firstName, "Ada");
    assert.equal(values.streetAddress, "");
    assert.deepEqual(registrationToFormValues(null), EMPTY_REGISTRATION_FORM);
  });

  it("rejects invalid email and phone on step 1", () => {
    const issues = validateStep(1, {
      ...EMPTY_REGISTRATION_FORM,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "bad",
      mobilePhone: "123",
    });
    assert.ok(issues.some((issue) => issue.field === "email"));
    assert.ok(issues.some((issue) => issue.field === "phone" || issue.field === "mobilePhone"));
  });

  it("enforces required church and address fields", () => {
    assert.ok(validateStep(2, EMPTY_REGISTRATION_FORM).length >= 3);
    assert.ok(validateStep(3, EMPTY_REGISTRATION_FORM).length >= 4);
    assert.equal(
      validateStep(1, {
        ...EMPTY_REGISTRATION_FORM,
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        mobilePhone: "3125551212",
      }).length,
      0,
    );
  });

  it("exposes accessible plain-language labels for every field", () => {
    for (const label of Object.values(REGISTRATION_FIELD_LABELS)) {
      assert.ok(label.length > 2);
      assert.doesNotMatch(label, /^[a-z_]+$/);
    }
  });
});
