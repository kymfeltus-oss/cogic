import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateRegistrationRequirements,
  REGISTRATION_WIZARD_STEPS,
  resolveRegisterWizardIntent,
} from "../registration-requirements";
import type { RegistrationRequirementsInput } from "../registration-requirements";

const input = (overrides: Partial<RegistrationRequirementsInput> = {}): RegistrationRequirementsInput => ({
  status: "draft", hasProduct: false, missingProfileFields: [], groupMemberCount: 1,
  juniorMissingDob: false, policyAccepted: false, totalAmountCents: 25000,
  amountPaidCents: 0, remainingBalanceCents: 25000, paymentStatus: null,
  credentialReady: false, credentialMissingWhileConfirmed: false, housingPreference: null,
  housingStatus: null, hasTravelActivity: false, requiredProfileFieldCount: 12, ...overrides,
});

describe("registration requirements evaluator", () => {
  it("resumes an empty registration at attendee with zero completion", () => {
    const result = evaluateRegistrationRequirements(input({
      status: "none", missingProfileFields: Array.from({ length: 12 }, (_, i) => `field-${i}`),
      groupMemberCount: 0, remainingBalanceCents: 0,
    }));
    assert.equal(result.resumeStep, REGISTRATION_WIZARD_STEPS.ATTENDEE_INFORMATION);
    assert.equal(result.totalCompletionPercent, 0);
    assert.deepEqual(result.allowedStepDestinations, [{ step: 1, destination: "attendee" }]);
  });

  it("uses the first incomplete persisted requirement as resumeStep", () => {
    const result = evaluateRegistrationRequirements(input({ hasProduct: true }));
    assert.equal(result.resumeStep, REGISTRATION_WIZARD_STEPS.POLICY_AGREEMENT);
    assert.deepEqual(result.completedRequirements.filter(({ complete }) => complete).map(({ id }) => id), ["profile", "product", "group"]);
    assert.equal(result.totalCompletionPercent, 43);
  });

  it("reaches 100 only from confirmed authoritative payment state", () => {
    const result = evaluateRegistrationRequirements(input({
      status: "confirmed", hasProduct: true, policyAccepted: true,
      housingPreference: "own_accommodations", paymentStatus: "paid",
      amountPaidCents: 25000, remainingBalanceCents: 0, credentialReady: true,
    }));
    assert.equal(result.totalCompletionPercent, 100);
    assert.equal(result.resumeStep, REGISTRATION_WIZARD_STEPS.COMPLETE);
    assert.equal(result.resumeStepId, "complete");
  });

  it("treats ?step= as intent and clamps illegal destinations to resumeStep", () => {
    const requirements = evaluateRegistrationRequirements(input({ hasProduct: true }));
    const allowed = resolveRegisterWizardIntent({
      requestedStep: "product",
      requirements,
    });
    assert.equal(allowed.intentAllowed, true);
    assert.equal(allowed.activeStepId, "product");
    assert.equal(allowed.clampedFromIllegalIntent, false);

    const illegal = resolveRegisterWizardIntent({
      requestedStep: "payment",
      requirements,
    });
    assert.equal(illegal.intentAllowed, false);
    assert.equal(illegal.clampedFromIllegalIntent, true);
    assert.equal(illegal.activeStepNumber, requirements.resumeStep);
    assert.equal(illegal.activeStepId, requirements.resumeStepId);
  });

  it("clamps empty-profile review and payment deep links to canonical Step 1", () => {
    const requirements = evaluateRegistrationRequirements(input({
      status: "none",
      missingProfileFields: Array.from({ length: 12 }, (_, index) => `field-${index}`),
      groupMemberCount: 0,
      remainingBalanceCents: 0,
    }));

    for (const requestedStep of ["review", "payment"]) {
      const resolved = resolveRegisterWizardIntent({ requestedStep, requirements });
      assert.equal(resolved.intentAllowed, false);
      assert.equal(resolved.clampedFromIllegalIntent, true);
      assert.equal(resolved.activeStepNumber, REGISTRATION_WIZARD_STEPS.ATTENDEE_INFORMATION);
      assert.equal(resolved.activeStepId, "attendee");
      assert.equal(`/register?step=${resolved.activeStepId}`, "/register?step=attendee");
    }
  });
});
