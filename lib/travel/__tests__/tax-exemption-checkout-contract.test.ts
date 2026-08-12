import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  applyCorporateTaxExemptionToTotals,
  clientClaimsChurchTaxExemptTravel,
} from "@/lib/travel/corporate/tax-exemption-checkout";
import { hasForbiddenClientCheckoutAuthority } from "@/lib/travel/checkout/client-authority";

const root = process.cwd();
const read = (filePath: string) => fs.readFileSync(path.join(root, filePath), "utf8");

describe("corporate tax exemption checkout filter", () => {
  it("detects Church Tax-Exempt Business Travel claims without trusting verification flags", () => {
    assert.equal(
      clientClaimsChurchTaxExemptTravel({
        travelPurpose: "Church Tax-Exempt Business Travel",
      }),
      true,
    );
    assert.equal(clientClaimsChurchTaxExemptTravel({ taxExemptClaim: true }), true);
    assert.equal(clientClaimsChurchTaxExemptTravel({ kind: "hotel" }), false);
  });

  it("keeps municipal tax in totals unless server applies exemption", () => {
    const retained = applyCorporateTaxExemptionToTotals({
      fareCents: 10_000,
      serviceFeeCents: 250,
      municipalTaxCents: 800,
      decision: { applied: false },
    });
    assert.equal(retained.taxAmountCents, 800);
    assert.equal(retained.totalAmountCents, 10_250);

    const exempt = applyCorporateTaxExemptionToTotals({
      fareCents: 10_000,
      serviceFeeCents: 250,
      municipalTaxCents: 800,
      decision: { applied: true },
    });
    assert.equal(exempt.taxAmountCents, 0);
    assert.equal(exempt.fareCents, 9_200);
    assert.equal(exempt.totalAmountCents, 9_450);
  });

  it("rejects client tax verification authority fields", () => {
    assert.equal(
      hasForbiddenClientCheckoutAuthority({ taxProfileId: "x" }, "create"),
      true,
    );
    assert.equal(
      hasForbiddenClientCheckoutAuthority({ verification_status: "verified" }, "create"),
      true,
    );
    assert.equal(
      hasForbiddenClientCheckoutAuthority({ taxExemptVerified: true }, "create"),
      true,
    );
    assert.equal(
      hasForbiddenClientCheckoutAuthority({ taxExemptClaim: true, offerId: "o1" }, "create"),
      false,
    );
  });

  it("wires create-intent through server tax-profile verification", () => {
    const createIntent = read("lib/travel/checkout/create-intent.ts");
    const route = read("app/api/travel/checkout/create-intent/route.ts");
    const stripe = read("lib/travel/checkout/stripe.ts");
    const resolver = read("lib/travel/corporate/resolve-tax-exemption.ts");
    const ledger = read("lib/travel/checkout/repository.ts");
    const migration = read(
      "supabase/migrations/20260811000500_travel_booking_transactions_tax_profile.sql",
    );

    assert.match(createIntent, /resolveCorporateTaxExemptionForCheckout/);
    assert.match(createIntent, /buildTaxExemptionSnapshotFields/);
    assert.match(createIntent, /getUserFromSession/);
    assert.match(createIntent, /clientClaimsChurchTaxExemptTravel/);
    assert.match(createIntent, /verifiedTaxProfileId/);
    assert.match(createIntent, /checkout_type: "travel_marketplace"/);
    assert.match(resolver, /tax_profile_id/);
    assert.match(resolver, /verificationStatus !== "verified"/);
    assert.match(resolver, /church_tax_profiles/);
    assert.match(route, /clientClaimsChurchTaxExemptTravel/);
    assert.match(route, /churchTaxExemptClaim/);
    assert.match(stripe, /tax_profile_id/);
    assert.match(stripe, /tax_exemption_applied/);
    assert.match(ledger, /tax_profile_id: taxProfileId/);
    assert.match(migration, /tax_profile_id uuid/);
  });
});
