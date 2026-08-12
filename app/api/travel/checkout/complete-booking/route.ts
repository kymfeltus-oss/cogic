import { NextRequest, NextResponse } from "next/server";
import { resolveAuthenticatedBuyer } from "@/lib/checkout/server";
import { fulfillPaidTravelCheckout } from "@/lib/travel/checkout/fulfill";
import { redactForLog, safeErrorMessage } from "@/lib/security/redact";

export const dynamic = "force-dynamic";

/**
 * POST /api/travel/checkout/complete-booking
 *
 * Automated transaction hook after card capture (Elements confirmPayment or Stripe webhook).
 * 1) Authenticate buyer and reject client-forced status / confirmation numbers
 * 2) Verify Stripe PaymentIntent.status === succeeded and amount matches ledger total
 * 3) Advance travel_booking_transactions + attempt to SUPPLIER_SUBMITTED
 * 4) Execute live Expedia Rapid / Duffel reservation create
 * 5) Persist supplier_confirmation_number + supplier_raw_response and mark CONFIRMED
 *
 * Absolute failure rollback: if payment settled but supplier rejects allocation,
 * write FAILED/REFUNDED on the ledger and execute an immediate Stripe refund.
 *
 * Prefer Stripe webhook payment_intent.succeeded in production; this route supports
 * authenticated client completion after Elements.
 */
export async function POST(request: NextRequest) {
  const auth = await resolveAuthenticatedBuyer(request);
  if (!auth) {
    return NextResponse.json(
      {
        error: "Sign in required.",
        loginUrl: `/login?next=${encodeURIComponent("/travel/trip")}`,
      },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid completion payload." }, { status: 400 });
  }

  if (
    body.status ||
    body.userId ||
    body.confirmationNumber ||
    body.supplier_confirmation_number ||
    body.supplierConfirmationNumber ||
    body.supplier_raw_response ||
    body.supplierRawResponse
  ) {
    return NextResponse.json(
      {
        error:
          "Client cannot force travel_transaction_status, supplier confirmation numbers, or supplier_raw_response.",
      },
      { status: 400 },
    );
  }

  const paymentIntentId = String(body.paymentIntentId || body.payment_intent_id || "").trim();
  const attemptId = String(body.attemptId || body.attempt_id || "").trim();
  if (!paymentIntentId) {
    return NextResponse.json({ error: "paymentIntentId is required." }, { status: 400 });
  }

  try {
    const result = await fulfillPaidTravelCheckout({
      paymentIntentId,
      userId: auth.buyer.userId,
      email: auth.buyer.email,
      guestOverride:
        body.guest && typeof body.guest === "object"
          ? {
              givenName: String(body.guest.givenName || ""),
              familyName: String(body.guest.familyName || ""),
              email: auth.buyer.email,
              phone: body.guest.phone ? String(body.guest.phone) : null,
              bornOn: body.guest.bornOn ? String(body.guest.bornOn) : null,
              gender: body.guest.gender === "f" ? "f" : body.guest.gender === "m" ? "m" : null,
              title: body.guest.title ? String(body.guest.title) : null,
            }
          : null,
    });

    if (attemptId && result.attemptId !== attemptId) {
      return NextResponse.json(
        { error: "PaymentIntent is not bound to the provided attempt." },
        { status: 409 },
      );
    }

    if (!result.ok) {
      const refundId = "refundId" in result ? result.refundId : null;
      return auth.withSessionCookies(
        NextResponse.json(
          {
            ok: false,
            attemptId: result.attemptId,
            status: result.status,
            supplierSubmitted: true,
            supplierConfirmed: false,
            supplierFailed: true,
            refundExecuted: Boolean(refundId),
            refundId,
            error: result.error,
            redirectTo:
              result.status === "REFUNDED"
                ? "/travel/trip?marketplace=refunded"
                : "/travel/trip?marketplace=failed",
          },
          { status: 409 },
        ),
      );
    }

    return auth.withSessionCookies(
      NextResponse.json({
        ok: true,
        attemptId: result.attemptId,
        status: result.status,
        supplierSubmitted: true,
        supplierConfirmed: true,
        supplierFailed: false,
        confirmationNumber: result.confirmationNumber,
        supplier_confirmation_number: result.confirmationNumber,
        idempotent: result.idempotent,
        redirectTo: "/travel/trip?marketplace=confirmed",
      }),
    );
  } catch (error) {
    console.error("[travel.checkout.complete-booking]", redactForLog(error));
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 });
  }
}
