import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { isAttendeeProtectedPath } from "@/lib/auth/routing";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("registration UI / security contracts", () => {
  it("uses Stripe dynamic payment methods for registration checkout", () => {
    const checkout = fs.readFileSync(path.join(root, "lib/registration/checkout.ts"), "utf8");
    assert.doesNotMatch(checkout, /payment_method_types/);
    assert.match(checkout, /dynamically present eligible cards, wallets, and flexible/);
  });

  it("protects registration routes for authenticated attendees", () => {
    assert.equal(isAttendeeProtectedPath("/register"), true);
    assert.equal(isAttendeeProtectedPath("/register/review"), true);
    assert.equal(isAttendeeProtectedPath("/register/payment/complete"), true);
  });

  it("wires registration checkout API and payment complete surface", () => {
    assert.equal(fs.existsSync(path.join(root, "app/api/registration/checkout/route.ts")), true);
    assert.equal(
      fs.existsSync(path.join(root, "app/register/payment/complete/page.tsx")),
      true,
    );
    assert.equal(fs.existsSync(path.join(root, "app/register/confirmation")), false);
  });

  it("wizard uses real submit/save actions and payment status UI", () => {
    const wizard = fs.readFileSync(
      path.join(root, "components/registration/RegistrationWizard.tsx"),
      "utf8",
    );
    const status = fs.readFileSync(
      path.join(root, "components/registration/RegistrationStatusPanel.tsx"),
      "utf8",
    );
    const payButton = fs.readFileSync(
      path.join(root, "components/registration/RegistrationCheckoutButton.tsx"),
      "utf8",
    );
    const actions = fs.readFileSync(
      path.join(root, "lib/registration/actions.ts"),
      "utf8",
    );

    assert.match(wizard, /updateRegistrationDraft/);
    assert.match(wizard, /submitRegistration/);
    assert.match(wizard, /htmlFor=/);
    assert.match(wizard, /aria-invalid/);
    assert.match(wizard, /aria-describedby/);
    assert.match(wizard, /aria-busy/);
    assert.match(wizard, /Step \{currentStep\} of 4/);
    assert.doesNotMatch(wizard, /href="#"/);
    assert.doesNotMatch(wizard, /console\.log/);
    assert.doesNotMatch(wizard, /You're registered|You are registered/i);

    assert.match(status, /honestSubmittedCopy/);
    assert.match(status, /RegistrationCheckoutButton/);
    assert.match(status, /server webhook/);
    assert.doesNotMatch(status, /You're registered/i);
    assert.doesNotMatch(status, /Payment processing is not available in this step yet/);

    assert.match(payButton, /\/api\/registration\/checkout/);
    assert.match(payButton, /credentials:\s*"include"/);

    assert.match(actions, /getUserFromSession/);
    assert.match(actions, /parseAccessContext/);
    assert.match(actions, /DEFAULT_PROGRAM_KEY/);
    assert.match(actions, /status !== "submitted"/);
    assert.doesNotMatch(actions, /payment_pending/);
    assert.doesNotMatch(actions, /status:\s*"confirmed"/);
  });

  it("repository forces server-controlled program_key and ownership checks", () => {
    const repository = fs.readFileSync(
      path.join(root, "lib/registration/repository.ts"),
      "utf8",
    );
    assert.match(repository, /return DEFAULT_PROGRAM_KEY/);
    assert.match(repository, /\.eq\("user_id", userId\)/);
    assert.match(repository, /status:\s*"submitted"/);
    assert.doesNotMatch(repository, /status:\s*"confirmed"/);
    assert.doesNotMatch(repository, /status:\s*"payment_pending"/);
  });

  it("register pages redirect unauthenticated users through real auth", () => {
    const page = fs.readFileSync(path.join(root, "app/register/page.tsx"), "utf8");
    const review = fs.readFileSync(
      path.join(root, "app/register/review/page.tsx"),
      "utf8",
    );
    assert.match(page, /buildAttendeeGateUrl\("\/register"\)/);
    assert.match(page, /isGuest/);
    assert.match(page, /getRegistrationFeeLabelOrNull/);
    assert.match(review, /buildAttendeeGateUrl\("\/register\/review"\)/);
    assert.match(review, /loadRegistrationForCurrentUser|createOrResumeRegistrationDraft/);
  });
});
