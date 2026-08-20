import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import {
  calculateRegistrationProgress,
  buildRegistrationBlockers,
  buildRegistrationNextActions,
  maskBadgeCode,
  registrationJourneySteps,
} from "../my-registration-state";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const baseInput = {
  status: "draft" as const,
  hasProduct: true,
  missingProfileFields: [] as string[],
  groupMemberCount: 1,
  juniorMissingDob: false,
  policyAccepted: false,
  totalAmountCents: 15000,
  amountPaidCents: 0,
  remainingBalanceCents: 15000,
  paymentStatus: null as string | null,
  credentialReady: false,
  credentialMissingWhileConfirmed: false,
  housingPreference: null as string | null,
  housingStatus: null as string | null,
  hasTravelActivity: false,
};

describe("attendee My Registration dashboard", () => {
  it("calculates progress from persisted required stages", () => {
    assert.equal(
      calculateRegistrationProgress({
        ...baseInput,
        status: "none",
        requiredProfileFieldCount: 12,
      }),
      0,
    );
    assert.equal(
      calculateRegistrationProgress({
        ...baseInput,
        missingProfileFields: ["Email", "Mobile phone"],
        requiredProfileFieldCount: 12,
      }),
      47,
    );
    assert.equal(
      calculateRegistrationProgress({
        ...baseInput,
        status: "confirmed",
        policyAccepted: true,
        remainingBalanceCents: 0,
        requiredProfileFieldCount: 12,
      }),
      100,
    );
  });

  it("exposes /my-convocation/registration as the single attendee registration surface", () => {
    assert.match(read("app/my-convocation/registration/page.tsx"), /MyRegistrationDashboard/);
    assert.match(read("app/my-convocation/registration/page.tsx"), /loadMyRegistrationDashboard/);
    assert.match(read("lib/dashboard/dashboard-utilities.ts"), /\/my-convocation\/registration/);
    assert.match(read("lib/navigation/attendee-primary-nav.ts"), /\/my-convocation\/registration/);
    assert.match(read("components/dashboard/MyConvocationCard.tsx"), /My Registration/);
    assert.doesNotMatch(
      read("components/dashboard/MyConvocationCard.tsx"),
      /credential-presentation|Show Credential/,
    );
  });

  it("handles no-registration and terminal states truthfully", () => {
    const none = buildRegistrationNextActions({ ...baseInput, status: "none" });
    assert.equal(none[0]?.label, "Begin Registration");
    assert.equal(none[0]?.href, "/register");

    const canceled = buildRegistrationNextActions({ ...baseInput, status: "canceled" });
    assert.ok(canceled.some((a) => a.label === "Start a new registration"));
    assert.ok(!canceled.some((a) => a.id === "complete_payment"));

    const refunded = buildRegistrationNextActions({ ...baseInput, status: "refunded" });
    assert.ok(refunded.some((a) => a.href === "/register"));
  });

  it("builds draft / submitted / payment_pending / confirmed journeys without redirect authority", () => {
    assert.equal(registrationJourneySteps("draft", false).find((s) => s.state === "current")?.id, "draft");
    assert.equal(
      registrationJourneySteps("submitted", false).find((s) => s.state === "current")?.id,
      "submitted",
    );
    assert.equal(
      registrationJourneySteps("payment_pending", false).find((s) => s.state === "current")?.id,
      "payment_pending",
    );
    assert.equal(
      registrationJourneySteps("confirmed", false).find((s) => s.state === "current")?.id,
      "confirmed",
    );
    assert.equal(
      registrationJourneySteps("confirmed", true).find((s) => s.state === "current")?.id,
      "credential_issued",
    );
    assert.ok(registrationJourneySteps("canceled", true).every((s) => s.state === "blocked"));
  });

  it("surfaces only applicable next actions and blockers", () => {
    const pending = buildRegistrationNextActions({
      ...baseInput,
      status: "payment_pending",
      policyAccepted: true,
    });
    assert.ok(pending.some((a) => a.id === "wait_stripe"));
    assert.ok(!pending.some((a) => a.label === "View credential"));

    const confirmed = buildRegistrationNextActions({
      ...baseInput,
      status: "confirmed",
      policyAccepted: true,
      amountPaidCents: 15000,
      remainingBalanceCents: 0,
      credentialReady: true,
    });
    assert.ok(confirmed.some((a) => a.id === "view_credential"));
    assert.ok(!confirmed.some((a) => a.id === "complete_payment"));

    const blockers = buildRegistrationBlockers({
      ...baseInput,
      status: "draft",
      juniorMissingDob: true,
      hasProduct: false,
      missingProfileFields: ["Email"],
    });
    assert.ok(blockers.some((b) => b.id === "junior_dob"));
    assert.ok(blockers.some((b) => b.id === "missing_product"));
    assert.ok(blockers.some((b) => b.id === "missing_profile"));
  });

  it("keeps Stripe webhook authority and blocks client confirmation/amount overrides", () => {
    const webhook = read("lib/registration/stripe-webhook.ts");
    const api = read("app/api/registration/dashboard/route.ts");
    const checkout = read("lib/registration/checkout.ts");
    assert.match(webhook, /confirmPaidGroup|issueRegistrationCredential|paid/);
    assert.match(api, /Client cannot override registration status, confirmation, or amounts/);
    assert.match(api, /getUserFromSession/);
    assert.match(checkout, /payment\/complete|register\/review/);
    assert.doesNotMatch(api, /status:\s*"confirmed"/);
  });

  it("reuses secure credential presentation without secrets", () => {
    const ui = read("components/registration/MyRegistrationDashboard.tsx");
    const api = read("app/api/registration/credential-presentation/route.ts");
    assert.match(ui, /\/api\/registration\/credential-presentation/);
    assert.match(api, /owner_user_id/);
    assert.match(api, /rotateRegistrationCredential/);
    assert.doesNotMatch(ui, /token_hash|rawToken|secure_token/);
    assert.equal(maskBadgeCode("ABCD1234"), "••••1234");
  });

  it("routes travel to COGIC Travel without rebuilding it inside registration", () => {
    const ui = read("components/registration/MyRegistrationDashboard.tsx");
    const loader = read("lib/registration/load-my-registration.ts");
    assert.doesNotMatch(ui, /Open housing|href=.*\/housing/);
    assert.match(ui, /Open COGIC Travel|\/travel/);
    assert.match(loader, /loadDashboardHousingSummary/);
    assert.match(loader, /loadDashboardTicketsSummary/);
    assert.match(ui, /data\.addOns\.issuedTicketCount/);
    assert.doesNotMatch(ui, /housingState/);
  });

  it("keeps overview cards readable in the mobile-width horizontal rail", () => {
    const css = read("app/my-convocation/registration/registration-dashboard.css");
    assert.match(css, /grid-auto-flow:\s*column/);
    assert.match(css, /overflow-x:\s*auto/);
    assert.match(css, /scroll-snap-type:\s*inline mandatory/);
    assert.match(css, /word-break:\s*normal/);
    assert.doesNotMatch(css, /grid-template-columns:\s*repeat\(5/);
  });

  it("documents owner parity for operational registration states", () => {
    const ownerApi = read("app/api/owner/registrations/route.ts");
    const ownerUi = read("components/owner/RegistrationManagementClient.tsx");
    assert.match(ownerApi, /cancel_registration|requireOwnerUser|registrations/);
    assert.match(ownerApi, /groupId is required/);
    assert.match(ownerApi, /pagination/);
    assert.match(ownerUi, /credential|policy|status/i);
    assert.match(ownerUi, /Load more|Audited profile correction/);
  });

  it("supports group/junior management rules in UI and experience API", () => {
    const ui = read("components/registration/MyRegistrationDashboard.tsx");
    const experience = read("app/api/registration/experience/route.ts");
    assert.match(ui, /Add group\/junior registrant/);
    assert.match(ui, /removeMember|DELETE/);
    assert.match(experience, /removeGroupRegistrant/);
    assert.match(read("lib/registration/slice2-repository.ts"), /is_primary_registrant|date_of_birth|child/);
  });
});
