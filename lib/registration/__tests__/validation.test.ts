import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertRegistrationSubmission,
  normalizeDraftInput,
  validateRegistrationSubmission,
} from "@/lib/registration/validation";

const validSubmission = {
  firstName: " Jane ",
  lastName: " Doe ",
  email: " Jane.Doe@Example.COM ",
  mobilePhone: "(312) 555-1212",
  streetAddress: " 100 Main St ",
  city: " Chicago ",
  state: "il",
  postalCode: "60601",
  churchName: " Temple of Praise ",
  pastorName: " Pastor Smith ",
  jurisdiction: " Illinois First ",
};

describe("registration validation", () => {
  it("normalizes draft input without requiring completeness", () => {
    const draft = normalizeDraftInput({
      firstName: "  Ada  ",
      email: " Ada@Example.COM ",
      mobilePhone: "312-555-9999",
      state: "il",
    });
    assert.equal(draft.firstName, "Ada");
    assert.equal(draft.email, "ada@example.com");
    assert.equal(draft.mobilePhone, "3125559999");
    assert.equal(draft.state, "IL");
    assert.equal(draft.lastName, undefined);
  });

  it("requires all submission fields with plain-language issues", () => {
    const issues = validateRegistrationSubmission({
      firstName: "",
      lastName: "",
      email: "bad",
      mobilePhone: "123",
      streetAddress: "",
      city: "",
      state: "XX",
      postalCode: "",
      churchName: "",
      pastorName: "",
      jurisdiction: "",
    });
    assert.ok(issues.length >= 8);
    assert.ok(issues.some((issue) => issue.field === "email"));
    assert.ok(issues.some((issue) => issue.field === "mobilePhone"));
    assert.ok(issues.some((issue) => issue.field === "state"));
  });

  it("normalizes a valid submission payload", () => {
    const normalized = assertRegistrationSubmission(validSubmission);
    assert.equal(normalized.email, "jane.doe@example.com");
    assert.equal(normalized.mobilePhone, "3125551212");
    assert.equal(normalized.state, "IL");
    assert.equal(normalized.churchName, "Temple of Praise");
  });

  it("rejects negative amount_cents", () => {
    const issues = validateRegistrationSubmission({
      ...validSubmission,
      amountCents: -1,
    });
    assert.ok(issues.some((issue) => issue.field === "amountCents"));
  });
});
