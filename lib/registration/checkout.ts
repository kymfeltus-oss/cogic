import "server-only";

import { NextRequest } from "next/server";
import Stripe from "stripe";

import {
  formatStripeCheckoutError,
  getAppUrl,
  getStripeSecretKey,
  resolveAuthenticatedBuyer,
} from "@/lib/checkout/server";
import { beginRegistrationCheckout, getCheckoutEligibleRegistration } from "@/lib/registration/payment-repository";
import { getRegistrationPricingConfig } from "@/lib/registration/pricing";
import { RegistrationError } from "@/lib/registration/errors";
import {
  DEFAULT_PROGRAM_KEY,
  REGISTRATION_CHECKOUT_TYPE,
} from "@/lib/registration/types";
import {
  enforceRegistrationCheckoutRateLimit,
  rateLimitResponseHeaders,
} from "@/lib/rate-limit";
import { redactForLog, safeErrorMessage } from "@/lib/security/redact";

function formatRegistrationCheckoutError(error: unknown): string {
  if (error instanceof RegistrationError) {
    return error.message;
  }
  return formatStripeCheckoutError(error);
}

export async function createRegistrationCheckoutSession(request: NextRequest) {
  const auth = await resolveAuthenticatedBuyer(request);
  if (!auth) {
    return { ok: false as const, status: 401, error: "Unauthorized." };
  }

  const { buyer, withSessionCookies } = auth;

  try {
    const rate = await enforceRegistrationCheckoutRateLimit(request, buyer.userId);
    if (!rate.allowed) {
      return {
        ok: false as const,
        status: 429,
        error: "Too many checkout attempts. Please try again shortly.",
        headers: rateLimitResponseHeaders(rate),
      };
    }

    const registration = await getCheckoutEligibleRegistration(buyer.userId);
    const pricing = getRegistrationPricingConfig();
    const stripeSecretKey = getStripeSecretKey();

    if (!stripeSecretKey) {
      return {
        ok: false as const,
        status: 500,
        error: "Payment processing is not configured.",
      };
    }

    const stripe = new Stripe(stripeSecretKey);
    const appUrl = getAppUrl(request);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Let Stripe dynamically present eligible cards, wallets, and flexible
      // payment methods configured for registration in the Stripe Dashboard.
      client_reference_id: buyer.userId,
      customer_email: registration.email ?? buyer.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: pricing.currency,
            unit_amount: pricing.amountCents,
            product_data: {
              name: "118th Holy Convocation Registration",
              description: "COGIC LIVE Convocation registration fee",
            },
          },
        },
      ],
      metadata: {
        checkout_type: REGISTRATION_CHECKOUT_TYPE,
        program_key: DEFAULT_PROGRAM_KEY,
        registration_id: registration.id,
        user_id: buyer.userId,
        email: registration.email ?? buyer.email,
        amount_cents: String(pricing.amountCents),
      },
      success_url: `${appUrl}/register/payment/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/register/review?checkout=canceled`,
    });

    if (!session.id || !session.url) {
      return {
        ok: false as const,
        status: 500,
        error: "Unable to create checkout session.",
      };
    }

    await beginRegistrationCheckout({
      userId: buyer.userId,
      stripeSessionId: session.id,
    });

    return {
      ok: true as const,
      url: session.url,
      withSessionCookies,
    };
  } catch (error) {
    console.error("[REGISTRATION_CHECKOUT_ERROR]", redactForLog(safeErrorMessage(error)));
    return {
      ok: false as const,
      status:
        error instanceof RegistrationError && error.code === "forbidden"
          ? 403
          : error instanceof RegistrationError &&
              (error.code === "not_editable" || error.code === "validation")
            ? 400
            : error instanceof RegistrationError && error.code === "not_found"
              ? 404
              : error instanceof RegistrationError && error.code === "conflict"
                ? 409
                : 500,
      error: formatRegistrationCheckoutError(error),
    };
  }
}
