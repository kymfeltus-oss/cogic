import { NextRequest, NextResponse } from "next/server";
import { resolveAuthenticatedBuyer } from "@/lib/checkout/server";
import { evaluateCheckoutAuthorityGate } from "@/lib/travel/checkout/client-authority";
import { createTravelCheckoutIntent } from "@/lib/travel/checkout/create-intent";
import { clientClaimsChurchTaxExemptTravel } from "@/lib/travel/corporate/tax-exemption-checkout";
import { redactForLog, safeErrorMessage } from "@/lib/security/redact";

export const dynamic = "force-dynamic";

/**
 * POST /api/travel/checkout/create-intent
 *
 * Payment-gate entry for live marketplace checkout.
 * 1) Reject client money / identity authority fields
 * 2) Authenticate buyer (server session — never trust client userId)
 * 3) Require live Expedia Rapid / Duffel env configuration for the selected kind
 * 4) Resolve offer_id / room package token + itemize fare, tax, service fee in cents
 * 5) Persist travel_marketplace_booking_attempts + travel_booking_transactions as DRAFT
 * 6) Create Stripe PaymentIntent and advance both rows to PAYMENT_PENDING
 *
 * Client cannot set amounts, status, or identity.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.json().catch(() => null);
  const gate = evaluateCheckoutAuthorityGate(rawBody, "create");
  if (gate.ok === false) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const body = gate.body;

  const auth = await resolveAuthenticatedBuyer(request);
  if (!auth) {
    return NextResponse.json(
      {
        error: "Sign in required.",
        loginUrl: `/login?next=${encodeURIComponent("/travel")}`,
      },
      { status: 401 },
    );
  }

  const kind = String(body.kind || "").toLowerCase();
  if (kind !== "hotel" && kind !== "flight" && kind !== "car") {
    return NextResponse.json(
      { error: "kind must be hotel, flight, or car." },
      { status: 400 },
    );
  }

  const offerId = String(body.offerId || body.offer_id || "").trim();
  const bookToken = String(
    body.bookToken || body.book_token || body.roomPackageToken || body.room_package_token || "",
  ).trim();
  if (!offerId && !bookToken) {
    return NextResponse.json(
      { error: "offer_id or room package token is required from the live provider layer." },
      { status: 400 },
    );
  }

  try {
    const offer =
      body.offer && typeof body.offer === "object" && !Array.isArray(body.offer)
        ? (body.offer as Record<string, unknown>)
        : null;
    const churchTaxExemptClaim = clientClaimsChurchTaxExemptTravel(body, offer);

    const result = await createTravelCheckoutIntent({
      userId: auth.buyer.userId,
      email: auth.buyer.email,
      kind,
      offerId: offerId || bookToken,
      bookToken: bookToken || null,
      provider: body.provider ? String(body.provider) : null,
      checkIn: body.checkIn ? String(body.checkIn) : null,
      checkOut: body.checkOut ? String(body.checkOut) : null,
      pickupAt: body.pickupAt ? String(body.pickupAt) : null,
      dropoffAt: body.dropoffAt ? String(body.dropoffAt) : null,
      adults: Number(body.adults) > 0 ? Number(body.adults) : null,
      offer,
      churchTaxExemptClaim,
      guest:
        body.guest && typeof body.guest === "object" && !Array.isArray(body.guest)
          ? (body.guest as {
              givenName?: string;
              familyName?: string;
              phone?: string | null;
              bornOn?: string | null;
              gender?: "m" | "f" | null;
              title?: string | null;
            })
          : null,
    });

    return auth.withSessionCookies(
      NextResponse.json(
        {
          attemptId: result.attemptId,
          transactionId: result.transactionId,
          status: result.status,
          draftStatus: "DRAFT",
          paymentGateStatus: "PAYMENT_PENDING",
          paymentIntentId: result.paymentIntentId,
          clientSecret: result.clientSecret,
          itemization: {
            fareCents: result.fareCents,
            taxAmountCents: result.taxAmountCents,
            serviceFeeCents: result.serviceFeeCents,
            totalAmountCents: result.amountCents,
          },
          amountCents: result.amountCents,
          fareCents: result.fareCents,
          taxAmountCents: result.taxAmountCents,
          serviceFeeCents: result.serviceFeeCents,
          currency: result.currency,
          provider: result.provider,
          kind: result.kind,
          offerId: result.offerId,
          taxExemptionApplied: result.taxExemptionApplied,
          taxProfileId: result.taxProfileId,
        },
        { status: 201 },
      ),
    );
  } catch (error) {
    console.error("[travel.checkout.create-intent]", redactForLog(error));
    const message = safeErrorMessage(error);
    const status =
      /not configured|requires Expedia|requires Duffel|missing a live|Live hotel checkout|Live flight checkout|Live rental-car checkout/i.test(
        message,
      )
        ? 503
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
