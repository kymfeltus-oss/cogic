import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { isAttendeeProtectedPath } from "@/lib/auth/routing";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("registration UI / security contracts", () => {
  it("protects registration routes for authenticated attendees", () => {
    assert.equal(isAttendeeProtectedPath("/register"), true);
    assert.equal(isAttendeeProtectedPath("/register/review"), true);
  });

  it("does not create checkout or confirmation fake-success routes", () => {
    assert.equal(fs.existsSync(path.join(root, "app/register/checkout")), false);
    assert.equal(fs.existsSync(path.join(root, "app/register/confirmation")), false);
  });

  it("wizard uses real submit/save actions and honest submitted copy", () => {
    const wizard = fs.readFileSync(
      path.join(root, "components/registration/RegistrationWizard.tsx"),
      "utf8",
    );
    const status = fs.readFileSync(
      path.join(root, "components/registration/RegistrationStatusPanel.tsx"),
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
    assert.doesNotMatch(wizard, /qr code|Stripe Checkout|You're registered/i);

    assert.match(status, /honestSubmittedCopy/);
    assert.match(status, /No QR credential/);
    assert.doesNotMatch(status, /You're registered/i);

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
    assert.match(review, /buildAttendeeGateUrl\("\/register\/review"\)/);
    assert.match(review, /loadRegistrationForCurrentUser|createOrResumeRegistrationDraft/);
  });
});
