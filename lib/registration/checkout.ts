import "server-only";

import { NextRequest } from "next/server";
import Stripe from "stripe";

import {
  formatStripeCheckoutError,
  getAppUrl,
  getStripeSecretKey,
  resolveAuthenticatedBuyer,
} from "@/lib/checkout/server";
import {
  beginRegistrationCheckout,
  cancelPendingRegistrationCheckout,
  getCheckoutEligibleRegistration,
  getLatestPendingRegistrationPayment,
} from "@/lib/registration/payment-repository";
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
import { interceptRegistrationCheckout } from "@/lib/registration/sandbox-interceptors";

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
    if (registration.amountCents === null || registration.amountCents <= 0) {
      return { ok: false as const, status: 400, error: "This registration does not require paid checkout." };
    }
    const appUrl = getAppUrl(request);
    const sandboxSession = interceptRegistrationCheckout({ registrationId: registration.id, appUrl });
    if (sandboxSession) {
      return { ok: true as const, url: sandboxSession.url, withSessionCookies, sandboxSession };
    }
    const stripeSecretKey = getStripeSecretKey();

    if (!stripeSecretKey) {
      return {
        ok: false as const,
        status: 500,
        error: "Payment processing is not configured.",
      };
    }

    const stripe = new Stripe(stripeSecretKey);
    const pendingPayment = await getLatestPendingRegistrationPayment(registration.id);

    if (pendingPayment?.stripeSessionId) {
      const pendingSession = await stripe.checkout.sessions.retrieve(pendingPayment.stripeSessionId);
      if (pendingSession.status === "open" && pendingSession.url) {
        return {
          ok: true as const,
          url: pendingSession.url,
          withSessionCookies,
        };
      }
      if (pendingSession.status === "complete") {
        return {
          ok: true as const,
          url: `${appUrl}/register/payment/complete?session_id=${encodeURIComponent(pendingSession.id)}`,
          withSessionCookies,
        };
      }

      await cancelPendingRegistrationCheckout({
        userId: buyer.userId,
        registrationId: registration.id,
        stripeSessionId: pendingPayment.stripeSessionId,
      });
    }

    const admin = (await import("@/lib/supabase/server")).getSupabaseAdmin();
    const { data: group } = await admin
      .from("registration_groups")
      .select("id,wizard_metadata")
      .eq("owner_user_id", buyer.userId)
      .eq("program_key", DEFAULT_PROGRAM_KEY)
      .maybeSingle();
    const metadata = (group?.wizard_metadata ?? {}) as Record<string, unknown>;
    const commerceLines: Array<{ type: "ticket" | "addon"; productId: string; quantity: number }> = [];
    const musicalQuantity = Number(metadata.musical_ticket_quantity ?? 0);
    if (musicalQuantity > 0 && metadata.musical_ticket_product_id) commerceLines.push({ type: "ticket", productId: String(metadata.musical_ticket_product_id), quantity: musicalQuantity });
    if (metadata.printed_program_selected === true && metadata.printed_program_product_id) commerceLines.push({ type: "addon", productId: String(metadata.printed_program_product_id), quantity: 1 });
    if (metadata.digital_program_selected === true && metadata.digital_program_product_id) commerceLines.push({ type: "addon", productId: String(metadata.digital_program_product_id), quantity: 1 });
    let commerceOrderId: string | null = null;
    let commerceOrderLines: Array<{ name_snapshot: string; quantity: number; unit_amount_cents: number }> = [];
    if (commerceLines.length) {
      const { data: reserved, error: reserveError } = await admin.rpc("reserve_commerce_order", {
        p_user_id: buyer.userId,
        p_program_key: DEFAULT_PROGRAM_KEY,
        p_lines: commerceLines,
        p_registration_group_id: group?.id ?? null,
      });
      if (reserveError) throw new RegistrationError("conflict", reserveError.message);
      commerceOrderId = String((reserved as { order_id?: string }).order_id ?? "") || null;
      if (commerceOrderId) {
        const { data: rows } = await admin.from("commerce_order_lines").select("name_snapshot,quantity,unit_amount_cents").eq("order_id", commerceOrderId);
        commerceOrderLines = rows ?? [];
      }
    }
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Let Stripe dynamically present eligible cards, wallets, and flexible
      // payment methods configured for registration in the Stripe Dashboard.
      client_reference_id: buyer.userId,
      customer_email: registration.email ?? buyer.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: registration.currency,
            unit_amount: registration.amountCents,
            product_data: {
              name: "118th Holy Convocation Registration",
              description: "COGIC LIVE Convocation registration fee",
            },
          },
        },
        ...commerceOrderLines.filter((line) => line.unit_amount_cents > 0).map((line) => ({
          quantity: line.quantity,
          price_data: { currency: registration.currency, unit_amount: line.unit_amount_cents, product_data: { name: line.name_snapshot } },
        })),
      ],
      metadata: {
        checkout_type: REGISTRATION_CHECKOUT_TYPE,
        program_key: DEFAULT_PROGRAM_KEY,
        registration_id: registration.id,
        user_id: buyer.userId,
        email: registration.email ?? buyer.email,
        amount_cents: String(registration.amountCents),
        commerce_order_id: commerceOrderId ?? "",
      },
      success_url: `${appUrl}/register/payment/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/register/review?checkout=canceled`,
      });
    } catch (error) {
      if (commerceOrderId) await admin.rpc("cancel_ticket_reservation", { p_order_id: commerceOrderId, p_user_id: buyer.userId });
      throw error;
    }

    if (!session.id || !session.url) {
      return {
        ok: false as const,
        status: 500,
        error: "Unable to create checkout session.",
      };
    }

    if (commerceOrderId) {
      await admin.from("commerce_orders").update({ stripe_session_id: session.id, status: "checkout_created" }).eq("id", commerceOrderId).eq("purchaser_user_id", buyer.userId);
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
