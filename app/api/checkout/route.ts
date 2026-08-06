import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getAppUrl,
  getStripeSecretKey,
  resolveAuthenticatedBuyer,
} from "@/lib/checkout/server";
import { getGivingFund } from "@/lib/giving/funds";
import { validateGivingCheckoutInput } from "@/lib/giving/validation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { redactForLog, safeErrorMessage } from "@/lib/security/redact";

/**
 * COGIC Giving checkout (one-time).
 *
 * Security model:
 * - Buyer identity resolved ONLY from verified Supabase session cookies.
 * - Amount/fund/note validated server-side.
 * - Stripe metadata stamped server-side for webhook reconciliation.
 *
 * Webhook: checkout.session.completed + checkout_type === "donation"
 * → fulfill_donation_checkout(session.id)
 */
export async function POST(request: NextRequest) {
  try {
    const stripeSecretKey = getStripeSecretKey();

    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "Payment processing is not configured." },
        { status: 500 },
      );
    }

    if (
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY.includes("yourActual")
    ) {
      return NextResponse.json(
        { error: "Supabase server credentials are not configured." },
        { status: 500 },
      );
    }

    const auth = await resolveAuthenticatedBuyer(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { buyer, withSessionCookies } = auth;
    const body = (await request.json()) as Record<string, unknown>;
    const validated = validateGivingCheckoutInput(body);

    if (validated.ok === false) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const { amountInCents, fundKey, note, source } = validated.value;
    const fund = getGivingFund(fundKey);
    if (!fund) {
      return NextResponse.json({ error: "Please select a valid fund." }, { status: 400 });
    }

    const stripe = new Stripe(stripeSecretKey);
    const appUrl = getAppUrl(request);
    const productName = `COGIC Giving — ${fund.label}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "link"],
      client_reference_id: buyer.userId,
      customer_email: buyer.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountInCents,
            product_data: {
              name: productName,
              description: note
                ? `Fund: ${fund.label}. Note: ${note}`
                : `Fund: ${fund.label}`,
            },
          },
        },
      ],
      metadata: {
        checkout_type: "donation",
        user_id: buyer.userId,
        email: buyer.email,
        amount_cents: String(amountInCents),
        frequency: "one_time",
        source: source ?? "cogic-giving",
        fund_key: fund.key,
        fund_label: fund.label,
        ...(note ? { donor_note: note } : {}),
      },
      success_url: `${appUrl}/giving?success=true`,
      cancel_url: `${appUrl}/giving?canceled=true`,
    });

    const supabase = getSupabaseAdmin();
    const { error: insertError } = await supabase.from("donations").insert({
      email: buyer.email,
      amount_cents: amountInCents,
      status: "pending",
      stripe_session_id: session.id,
    });

    if (insertError) {
      console.error(
        "Failed to stage donation record:",
        redactForLog(insertError.message),
      );
      return NextResponse.json(
        { error: "Unable to initialize donation record." },
        { status: 500 },
      );
    }

    if (!session.url) {
      return NextResponse.json(
        { error: "Unable to create checkout session." },
        { status: 500 },
      );
    }

    return withSessionCookies(NextResponse.json({ url: session.url }));
  } catch (error) {
    console.error("Donation checkout session error:", safeErrorMessage(error));
    return NextResponse.json(
      { error: "Unable to start checkout. Please try again." },
      { status: 500 },
    );
  }
}
