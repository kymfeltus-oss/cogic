import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, type PostgrestError } from "@supabase/supabase-js";
import { getEventTicketTier, isEventTicketTierId } from "@/lib/merch/catalog";
import {
  parseSeedPackCheckoutCount,
  SEED_PACK_LEGACY_ORDER_BASE_CREDIT,
  SEED_PACK_LEGACY_ORDER_PRODUCT_TYPE,
} from "@/lib/billing-config";
import { fulfillRegistrationCheckoutFromWebhook } from "@/lib/registration/stripe-webhook";
import { REGISTRATION_CHECKOUT_TYPE } from "@/lib/registration/types";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";
import { redactForLog, safeErrorMessage } from "@/lib/security/redact";

function getStripeClient(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey || stripeSecretKey.includes("yourActual")) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  // Stripe Node SDK v22 pins a typed API version internally — omit explicit override
  // to stay compatible with the installed package while preserving signature verification.
  return new Stripe(stripeSecretKey);
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const email = value.trim().toLowerCase();
  return email.length > 0 ? email : null;
}

function isIdempotencyConflict(error: PostgrestError | null): boolean {
  if (!error) return false;
  return error.code === "23505" || error.message.toLowerCase().includes("duplicate key");
}

function formatErrorMessage(error: unknown): string {
  return safeErrorMessage(error);
}

/**
 * Cryptographic Stripe webhook listener — tamper-proof checkout fulfillment.
 *
 * Trust model:
 * - Verify Stripe signature on the raw request body (never parse JSON first).
 * - Read identity ONLY from Stripe-signed session fields bound at checkout.
 * - Fulfill via SUPABASE_SERVICE_ROLE_KEY → Postgres RPC engines.
 */
export async function POST(request: Request) {
  const bodyText = await request.text();
  const headerList = await headers();
  const signature = headerList.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (!signature || !webhookSecret) {
      return NextResponse.json(
        { error: "Missing webhook configuration tokens." },
        { status: 400 },
      );
    }

    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(bodyText, signature, webhookSecret);
  } catch (error) {
    console.error(`❌ [STRIPE_SIGNATURE_ERROR]: ${formatErrorMessage(error)}`);
    return NextResponse.json(
      {
        error: `Webhook Signature Verification Failed: ${formatErrorMessage(error)}`,
      },
      { status: 400 },
    );
  }

  let supabaseAdmin;

  try {
    supabaseAdmin = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch (error) {
    console.error("❌ [WEBHOOK_CONFIG_ERROR]:", formatErrorMessage(error));
    return NextResponse.json(
      { error: "Supabase server credentials are not configured." },
      { status: 500 },
    );
  }

  async function fulfillDonation(session: Stripe.Checkout.Session) {
    try {
      const { error } = await supabaseAdmin.rpc("fulfill_donation_checkout", {
        p_stripe_session_id: session.id,
      });

      if (error) {
        if (isIdempotencyConflict(error)) {
          return NextResponse.json(
            { received: true, message: "Donation already fulfilled." },
            { status: 200 },
          );
        }
        throw error;
      }

      console.info("✅ [DONATION_FULFILLMENT_SUCCESS]:", session.id);
      return NextResponse.json({ received: true, eventId: event.id }, { status: 200 });
    } catch (error) {
      console.error("❌ [DATABASE_WEBHOOK_FULFILL_CRASH]:", redactForLog(error));
      return NextResponse.json(
        { error: "Server transactional processing lock failed." },
        { status: 500 },
      );
    }
  }

  if (event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.checkout_type === "donation") {
      return fulfillDonation(session);
    }
  }

  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.checkout_type === "donation") {
      const { error } = await supabaseAdmin
        .from("donations")
        .update({ status: "failed" })
        .eq("stripe_session_id", session.id)
        .eq("status", "pending");
      if (error) {
        console.error("❌ [DONATION_ASYNC_FAILURE_UPDATE]:", redactForLog(error));
        return NextResponse.json({ error: "Unable to record failed payment." }, { status: 500 });
      }
      return NextResponse.json({ received: true, eventId: event.id }, { status: 200 });
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const checkoutType = session.metadata?.checkout_type;

    if (checkoutType === "donation") {
      if (session.payment_status !== "paid") {
        return NextResponse.json(
          { received: true, message: "Donation payment is pending settlement." },
          { status: 200 },
        );
      }
      return fulfillDonation(session);
    }

    if (checkoutType === REGISTRATION_CHECKOUT_TYPE) {
      try {
        const result = await fulfillRegistrationCheckoutFromWebhook({
          session,
          supabaseAdmin,
        });

        if (result.ok === false) {
          console.error(
            "❌ [REGISTRATION_WEBHOOK_FULFILL_FAIL]:",
            redactForLog(result.error),
          );
          return NextResponse.json({ error: result.error }, { status: result.status });
        }

        console.info("✅ [REGISTRATION_FULFILLMENT_SUCCESS]:", {
          sessionId: session.id,
          registrationId: result.registrationId,
          idempotent: result.idempotent,
          credentialIssued: result.credentialIssued,
        });
      } catch (error) {
        console.error("❌ [REGISTRATION_WEBHOOK_CRASH]:", redactForLog(error));
        return NextResponse.json(
          { error: "Registration fulfillment failed." },
          { status: 500 },
        );
      }

      return NextResponse.json({ received: true, eventId: event.id }, { status: 200 });
    }

    if (checkoutType === "seed_pack") {
      const userId = session.client_reference_id?.trim() ?? null;
      const metadataUserId = session.metadata?.user_id?.trim() ?? null;
      const userEmail =
        normalizeEmail(session.metadata?.email) ??
        normalizeEmail(session.customer_details?.email);
      const amountTotal = session.amount_total ?? 0;
      const seedCount = parseSeedPackCheckoutCount(session.metadata ?? undefined);

      if (!userId || !userEmail || amountTotal <= 0 || seedCount <= 0) {
        console.error(
          "❌ [SEED_PACK_WEBHOOK_DATA_MISSING]:",
          session.id,
          { userId, userEmail, amountTotal, seedCount },
        );
        return NextResponse.json(
          { error: "Seed pack checkout metadata missing." },
          { status: 422 },
        );
      }

      if (metadataUserId && metadataUserId !== userId) {
        return NextResponse.json(
          { error: "Checkout identity mismatch." },
          { status: 422 },
        );
      }

      try {
        const { data: existingOrder } = await supabaseAdmin
          .from("orders")
          .select("status")
          .eq("stripe_session_id", session.id)
          .maybeSingle();

        if (existingOrder?.status === "paid") {
          return NextResponse.json(
            { received: true, message: "Seed pack already fulfilled." },
            { status: 200 },
          );
        }

        const { error: rpcError } = await supabaseAdmin.rpc(
          "fulfill_stripe_checkout_session",
          {
            p_stripe_session_id: session.id,
            p_user_id: userId,
            p_email: userEmail,
            p_product_id: SEED_PACK_LEGACY_ORDER_PRODUCT_TYPE,
            p_amount_total: amountTotal,
            p_selected_size: "N/A",
          },
        );

        if (rpcError) throw rpcError;

        const bonusSeeds = seedCount - SEED_PACK_LEGACY_ORDER_BASE_CREDIT;
        if (bonusSeeds > 0) {
          const { error: creditError } = await supabaseAdmin.rpc("credit_seed_wallet", {
            p_user_id: userId,
            p_amount: bonusSeeds,
          });
          if (creditError) throw creditError;
        }

        console.info(
          `✅ [SEED_PACK_FULFILLMENT_SUCCESS]: ${seedCount} seeds for ${userEmail}`,
        );
      } catch (error) {
        const pgError = error as PostgrestError;

        if (isIdempotencyConflict(pgError)) {
          return NextResponse.json(
            { received: true, message: "Idempotency checkpoint bypassed." },
            { status: 200 },
          );
        }

        console.error("❌ [SEED_PACK_FULFILL_CRASH]:", redactForLog(error));
        return NextResponse.json(
          { error: "Seed pack fulfillment failed." },
          { status: 500 },
        );
      }

      return NextResponse.json({ received: true, eventId: event.id }, { status: 200 });
    }

    const userId = session.client_reference_id?.trim() ?? null;
    const metadataUserId = session.metadata?.user_id?.trim() ?? null;
    const userEmail =
      normalizeEmail(session.metadata?.email) ??
      normalizeEmail(session.customer_details?.email);
    const productId =
      session.metadata?.product_id?.trim() ??
      session.metadata?.product_type?.trim() ??
      null;
    const amountTotal = session.amount_total ?? 0;
    const selectedSize = session.metadata?.selected_size?.trim() ?? "N/A";

    if (!userId || !userEmail || !productId || amountTotal <= 0) {
      console.error(
        "❌ [WEBHOOK_CRITICAL_DATA_MISSING]: Immutability parameters were unassigned during session configuration.",
        session.id,
      );
      return NextResponse.json(
        { error: "Data parsing parameters missing." },
        { status: 422 },
      );
    }

    if (metadataUserId && metadataUserId !== userId) {
      console.error("❌ [WEBHOOK_IDENTITY_MISMATCH]:", {
        sessionId: session.id,
        metadataUserId,
        referenceUserId: userId,
      });
      return NextResponse.json(
        { error: "Checkout identity mismatch." },
        { status: 422 },
      );
    }

    try {
      console.info(
        `⚡ Processing transaction fulfillment loop for user: ${userId} (${productId})`,
      );

      if (isEventTicketTierId(productId)) {
        const ticketTier = getEventTicketTier(productId);


        if (!ticketTier?.hasAccess) {
          throw new Error(`Ticket tier ${productId} is not configured for access.`);
        }

        const { error: rpcError } = await supabaseAdmin.rpc("fulfill_event_ticket_tier", {
          p_stripe_session_id: session.id,
          p_user_id: userId,
          p_email: userEmail,
          p_product_id: productId,
          p_amount_total: amountTotal,
          p_seed_bonus: ticketTier.seedBonus,
        });

        if (rpcError) throw rpcError;

        console.info(
          `✅ [TICKET_FULFILLMENT_SUCCESS]: Access pass and seed bonus successfully unlocked for ${userEmail}`,
        );
      } else {
        const { error: rpcError } = await supabaseAdmin.rpc(
          "fulfill_stripe_checkout_session",
          {
            p_stripe_session_id: session.id,
            p_user_id: userId,
            p_email: userEmail,
            p_product_id: productId,
            p_amount_total: amountTotal,
            p_selected_size: selectedSize,
          },
        );

        if (rpcError) throw rpcError;

        console.info(
          `✅ [STANDARD_FULFILLMENT_SUCCESS]: Order transaction fully logged for ${userEmail}`,
        );
      }
    } catch (error) {
      const pgError = error as PostgrestError;

      if (isIdempotencyConflict(pgError)) {
        console.warn(
          `⚠️ [IDEMPOTENCY_INTERCEPT]: Event session ${session.id} was already fulfilled. Gracefully acknowledging.`,
        );
        return NextResponse.json(
          { received: true, message: "Idempotency checkpoint bypassed." },
          { status: 200 },
        );
      }

      console.error("❌ [DATABASE_WEBHOOK_FULFILL_CRASH]:", redactForLog(error));
      return NextResponse.json(
        { error: "Server transactional processing lock failed." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ received: true, eventId: event.id }, { status: 200 });
}
