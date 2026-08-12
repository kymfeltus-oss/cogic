import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { POST as confirmPost } from "../../../app/api/travel/marketplace/booking/confirm/route";
import { POST as recheckPost } from "../../../app/api/travel/marketplace/booking/recheck/route";
import {
  assertExactBookTokenMatch,
  evaluateCheckoutAuthorityGate,
  hasForbiddenClientCheckoutAuthority,
  selectAuthoritativeFareCents,
} from "../checkout/client-authority";

const root = process.cwd();

describe("travel runtime integration — 5 MUST-FIX gaps", () => {
  it("amount tampering defense rejects client money fields and keeps live fare authority", () => {
    const tampered = {
      kind: "hotel",
      offerId: "prop:token",
      bookToken: "token",
      amountCents: 100,
      totalAmountCents: 100,
      fareCents: 50,
      offer: {
        propertyId: "prop",
        bookToken: "token",
        totalRateCents: 100,
        totalAmountCents: 100,
      },
    };

    assert.equal(hasForbiddenClientCheckoutAuthority(tampered, "create"), true);
    const gate = evaluateCheckoutAuthorityGate(tampered, "create");
    assert.equal(gate.ok, false);
    if (gate.ok === false) {
      assert.equal(gate.status, 400);
      assert.match(gate.error, /cannot set|charged amounts/i);
    }

    // Simulated live Expedia reprice overwrites poisoned client totals.
    const liveFareCents = 24900;
    const authoritative = selectAuthoritativeFareCents(liveFareCents, tampered.offer);
    assert.equal(authoritative, liveFareCents);
    assert.notEqual(authoritative, Number(tampered.offer.totalRateCents));
    assert.notEqual(authoritative, Number(tampered.amountCents));

    assert.throws(
      () => assertExactBookTokenMatch("client-token-A", "live-token-B", "hotel"),
      /bookToken divergence/i,
    );
    assert.equal(assertExactBookTokenMatch("same-token", "same-token", "hotel"), "same-token");

    // Valid create shape (no money fields) passes the authority gate.
    const clean = evaluateCheckoutAuthorityGate(
      {
        kind: "hotel",
        offerId: "prop:token",
        bookToken: "token",
        offer: { propertyId: "prop", bookToken: "token", name: "Demo" },
      },
      "create",
    );
    assert.equal(clean.ok, true);
  });

  it("zero-trust checkout rejects forged identity and charges only provider-retrieved mock rates", () => {
    const attacks = [
      { amountCents: 100 },
      { totalAmountCents: 500 },
      { userId: "attacker-controlled-user" },
    ];

    for (const injection of attacks) {
      const payload = {
        kind: "hotel",
        offerId: "elite-hotel-offer",
        bookToken: "expedia-live-token",
        offer: {
          propertyId: "elite-hotel",
          bookToken: "expedia-live-token",
          totalRateCents: 100,
          totalAmountCents: 500,
        },
        ...injection,
      };
      const gate = evaluateCheckoutAuthorityGate(payload, "create");
      assert.equal(gate.ok, false, `authority injection must fail: ${JSON.stringify(injection)}`);
      if (gate.ok === false) assert.equal(gate.status, 400);
    }

    const poisonedOffer = {
      totalRateCents: 100,
      totalFareCents: 500,
      totalAmountCents: 1,
      fareCents: 1,
    };
    const expediaRetrievedCents = 15_000;
    const duffelRetrievedCents = 7_500;

    assert.equal(
      selectAuthoritativeFareCents(expediaRetrievedCents, poisonedOffer),
      expediaRetrievedCents,
    );
    assert.equal(
      selectAuthoritativeFareCents(duffelRetrievedCents, poisonedOffer),
      duffelRetrievedCents,
    );

    assert.throws(
      () => assertExactBookTokenMatch("attacker-token", "expedia-live-token", "hotel"),
      /bookToken divergence detected/i,
    );
  });

  it("session-less resume accepts attemptId-only payloads and rejects stash/money injection", () => {
    const stashInjection = {
      attemptId: "11111111-1111-4111-8111-111111111111",
      offerSnapshot: { totalRateCents: 1, bookToken: "poison" },
      amountCents: 1,
    };
    assert.equal(hasForbiddenClientCheckoutAuthority(stashInjection, "resume"), true);
    const rejected = evaluateCheckoutAuthorityGate(stashInjection, "resume");
    assert.equal(rejected.ok, false);
    if (rejected.ok === false) {
      assert.equal(rejected.status, 400);
      assert.match(rejected.error, /cannot set|offer snapshot|charged amounts/i);
    }

    // attemptId alone is the resume key — no sessionStorage / offer stash required.
    const attemptOnly = evaluateCheckoutAuthorityGate(
      { attemptId: "11111111-1111-4111-8111-111111111111" },
      "resume",
    );
    assert.equal(attemptOnly.ok, true);

    const missingAttempt = evaluateCheckoutAuthorityGate({}, "resume");
    assert.equal(missingAttempt.ok, false);
    if (missingAttempt.ok === false) {
      assert.equal(missingAttempt.status, 400);
      assert.match(missingAttempt.error, /attemptId is required/i);
    }
  });

  it("retired manual confirmation endpoints return HTTP 410 and partner handoff routes are gone", async () => {
    assert.equal(
      existsSync(path.join(root, "app/api/travel/marketplace/booking/start/route.ts")),
      false,
    );
    assert.equal(
      existsSync(path.join(root, "app/api/travel/marketplace/booking/return/route.ts")),
      false,
    );

    for (const [name, handler] of [
      ["confirm", confirmPost],
      ["recheck", recheckPost],
    ] as const) {
      const response = await handler();
      assert.equal(response.status, 410, `${name} must return 410`);
      const body = await response.json();
      assert.match(
        String(body.code || body.error || ""),
        /retired|manual_confirm_retired|recheck_retired/i,
        `${name} must advertise retirement`,
      );
    }
  });
});
