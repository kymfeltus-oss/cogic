import { NextRequest, NextResponse } from "next/server";
import { resolveAuthenticatedBuyer } from "@/lib/checkout/server";
import { evaluateCheckoutAuthorityGate } from "@/lib/travel/checkout/client-authority";
import { resumeTravelCheckoutAttempt } from "@/lib/travel/checkout/resume";
import { redactForLog, safeErrorMessage } from "@/lib/security/redact";

export const dynamic = "force-dynamic";

/**
 * POST /api/travel/checkout/resume
 *
 * Resume PAYMENT_PENDING / DRAFT marketplace checkout by attempt_id.
 * Auth: resolveAuthenticatedBuyer (session). Never trust client amounts or PI fields.
 * PI reuse / recreate is performed server-side in resumeTravelCheckoutAttempt.
 * SessionStorage / offer stash is not required — attemptId alone is the resume key.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.json().catch(() => null);
  const gate = evaluateCheckoutAuthorityGate(rawBody, "resume");
  if (gate.ok === false) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const body = gate.body;
  const attemptId = String(body.attemptId || body.attempt_id || "").trim();

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

  try {
    const result = await resumeTravelCheckoutAttempt({
      userId: auth.buyer.userId,
      email: auth.buyer.email,
      attemptId,
    });

    if (result.mode === "redirect") {
      return auth.withSessionCookies(
        NextResponse.json({
          mode: result.mode,
          attemptId: result.attemptId,
          status: result.status,
          redirectTo: result.redirectTo,
        }),
      );
    }

    if (!result.clientSecret || !result.paymentIntentId) {
      return NextResponse.json(
        { error: "Unable to resume checkout without a server PaymentIntent client_secret." },
        { status: 500 },
      );
    }

    return auth.withSessionCookies(
      NextResponse.json({
        mode: result.mode,
        attemptId: result.attemptId,
        transactionId: result.transactionId,
        status: result.status,
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
        offerSnapshot: result.offerSnapshot,
        destinationLabel: result.destinationLabel,
        originLabel: result.originLabel,
        startAt: result.startAt,
        endAt: result.endAt,
        priorAttemptId: "priorAttemptId" in result ? result.priorAttemptId : null,
      }),
    );
  } catch (error) {
    console.error("[travel.checkout.resume]", redactForLog(error));
    const message = safeErrorMessage(error);
    const status = /not found|closed/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
