import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isAttendeeProtectedPath } from "@/lib/auth/routing";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("registration UI / security contracts", () => {
  it("uses Stripe dynamic payment methods for registration checkout", () => {
    const checkout = read("lib/registration/checkout.ts");
    assert.doesNotMatch(checkout, /payment_method_types/);
    assert.match(checkout, /dynamically present eligible cards, wallets, and flexible/);
    assert.match(checkout, /getLatestPendingRegistrationPayment/);
    assert.match(checkout, /cancelPendingRegistrationCheckout/);
  });

  it("protects registration routes for authenticated attendees", () => {
    assert.equal(isAttendeeProtectedPath("/register"), true);
    assert.equal(isAttendeeProtectedPath("/register/review"), true);
    assert.equal(isAttendeeProtectedPath("/register/payment/complete"), true);
  });

  it("keeps the checkout API and confirmation surface connected", () => {
    assert.equal(fs.existsSync(path.join(root, "app/api/registration/checkout/route.ts")), true);
    assert.equal(fs.existsSync(path.join(root, "app/register/payment/complete/page.tsx")), true);
    assert.equal(fs.existsSync(path.join(root, "app/register/confirmation")), false);
  });

  it("uses one persisted group flow for registration, review, and payment", () => {
    const flow = read("components/registration/RegistrationSlice2Experience.tsx");
    const status = read("components/registration/RegistrationGroupStatus.tsx");
    const repository = read("lib/registration/slice2-repository.ts");
    const checkoutButton = read("components/registration/RegistrationCheckoutButton.tsx");

    assert.match(flow, /save_registrant/);
    assert.match(flow, /save_primary_draft/);
    assert.match(flow, /submit_group/);
    assert.match(flow, /RegistrationPolicyDocument/);
    assert.match(flow, /HousingExperience/);
    assert.match(flow, /getGroupTotalCents/);
    assert.match(flow, /isJuniorRegistrationProduct/);
    assert.match(flow, /REGISTRATION_WIZARD_STEPS/);
    assert.match(flow, /TOTAL_WIZARD_STEPS/);
    assert.match(flow, /Step \{stepDisplayNumber\} of \{TOTAL_WIZARD_STEPS\}/);
    assert.doesNotMatch(flow, /of 8/);
    assert.doesNotMatch(flow, /href="#"/);
    assert.doesNotMatch(flow, /console\.log/);

    assert.match(status, /RegistrationCheckoutButton/);
    assert.match(status, /deriveRegistrationCheckoutResumeMode/);
    assert.match(status, /canShowRegistrationCheckoutResume/);
    assert.match(status, /Resume secure payment/);
    assert.match(status, /router\.refresh/);
    assert.match(status, /Plan My Trip/);
    assert.match(status, /Go to My Convocation/);
    assert.doesNotMatch(status, /fake|demo/i);
    assert.doesNotMatch(status, /duplicating charges/);

    const checkoutResume = read("lib/registration/checkout-resume.ts");
    assert.match(checkoutResume, /pending_session/);
    assert.match(checkoutResume, /stale_replace/);
    assert.match(checkoutResume, /webhook_processing/);
    assert.match(checkoutResume, /not payment authority/);

    assert.match(repository, /registration_group_id/);
    assert.match(repository, /isJuniorRegistrationProduct/);
    assert.match(repository, /policy_content_hash/);
    assert.match(repository, /eq\("registration_group_id", group\.id\)/);
    assert.match(repository, /findActiveLegacyRegistration/);
    assert.match(repository, /is\("registration_group_id", null\)/);
    assert.match(repository, /loadOrMigrateRegistrationExperience/);

    assert.match(checkoutButton, /\/api\/registration\/checkout/);
    assert.match(checkoutButton, /credentials:\s*"include"/);
  });

  it("removes duplicate legacy registration surfaces", () => {
    for (const relativePath of [
      "components/registration/RegistrationWizard.tsx",
      "components/registration/RegistrationStatusPanel.tsx",
      "components/registration/RegistrationPaymentCompleteClient.tsx",
      "lib/registration/actions.ts",
      "lib/registration/form-model.ts",
      "lib/registration/fee-display.ts",
    ]) {
      assert.equal(fs.existsSync(path.join(root, relativePath)), false, relativePath);
    }
  });

  it("redirects each registration page through the real group state", () => {
    const page = read("app/register/page.tsx");
    const review = read("app/register/review/page.tsx");
    const complete = read("app/register/payment/complete/page.tsx");

    assert.match(page, /buildAttendeeGateUrl\("\/register"\)/);
    assert.match(page, /loadOrMigrateRegistrationExperience/);
    assert.match(page, /initial\.group\?\.status === "confirmed"/);
    assert.match(page, /resolveRegisterWizardIntent/);
    assert.match(page, /resolved\.clampedFromIllegalIntent/);
    assert.match(page, /redirect\(`\/register\?step=\$\{resolved\.activeStepId\}`\)/);
    assert.match(page, /clampedFromIllegalIntent/);
    assert.match(page, /intent signal, not a permission/);
    assert.match(review, /buildAttendeeGateUrl\("\/register\/review"\)/);
    assert.match(review, /RegistrationGroupStatus/);
    assert.match(review, /loadOrMigrateRegistrationExperience/);
    assert.match(complete, /buildAttendeeGateUrl\("\/register\/payment\/complete"\)/);
    assert.match(complete, /RegistrationGroupStatus/);
    const experienceApi = read("app/api/registration/experience/route.ts");
    assert.match(experienceApi, /parseAccessContext/);
    assert.match(experienceApi, /Create an attendee account to continue registration/);
  });

  it("lets owners publish or withdraw existing products", () => {
    const route = read("app/api/owner/registration-products/route.ts");
    const client = read("components/owner/RegistrationProductAccessClient.tsx");
    assert.match(route, /typeof isPublic === "boolean"/);
    assert.match(route, /updates\.public = isPublic/);
    assert.match(client, /Publish to attendees/);
    assert.match(client, /Make private/);
  });
});
