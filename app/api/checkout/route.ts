import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getAppUrl,
  getStripeSecretKey,
  resolveAuthenticatedBuyer,
} from "@/lib/checkout/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type DonationFrequency = "one_time" | "monthly" | "weekly";

type DonationCheckoutBody = {
  amountInCents?: number;
  frequency?: DonationFrequency;
  source?: string;
};

const MIN_DONATION_CENTS = 50;

/**
 * Vital Seed donation checkout.
 *
 * Security model:
 * - Buyer identity (email, user_id) is resolved ONLY from verified Supabase session cookies.
 * - Request body accepts amountInCents alone — never customerEmail or identity fields.
 * - Stripe session metadata is stamped server-side for tamper-proof webhook reconciliation.
 *
 * Webhook follow-up (app/api/webhooks/stripe/route.ts):
 * - On checkout.session.completed, reconcile donations by stripe_session_id (Stripe-signed).
 * - Read session.client_reference_id and session.metadata.user_id / metadata.email
 *   for audit cross-checks — never trust any client-supplied email at webhook time.
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

    const body = (await request.json()) as DonationCheckoutBody;
    const amountInCents = body.amountInCents;
    const frequency: DonationFrequency =
      body.frequency === "monthly" || body.frequency === "weekly"
        ? body.frequency
        : "one_time";
    const source =
      typeof body.source === "string" && body.source.trim()
        ? body.source.trim()
        : "vital-seed-giving";

    if (
      typeof amountInCents !== "number" ||
      !Number.isInteger(amountInCents) ||
      amountInCents < MIN_DONATION_CENTS
    ) {
      return NextResponse.json(
        { error: "Please enter a valid gift amount." },
        { status: 400 },
      );
    }

    const stripe = new Stripe(stripeSecretKey);
    const appUrl = getAppUrl(request);
    const isRecurring = frequency === "monthly" || frequency === "weekly";
    const recurringInterval = frequency === "weekly" ? "week" : "month";

    const session = await stripe.checkout.sessions.create({
      mode: isRecurring ? "subscription" : "payment",
      payment_method_types: ["card", "link"],
      client_reference_id: buyer.userId,
      customer_email: buyer.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountInCents,
            ...(isRecurring
              ? { recurring: { interval: recurringInterval } }
              : {}),
            product_data: {
              name: "Vital Seed Giving — Sound & Healing Partner Offering",
            },
          },
        },
      ],
      metadata: {
        checkout_type: isRecurring ? "donation_recurring" : "donation",
        user_id: buyer.userId,
        email: buyer.email,
        amount_cents: String(amountInCents),
        frequency,
        source,
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
      console.error("Failed to stage donation record:", insertError.message);
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
    console.error("Donation checkout session error:", error);
    return NextResponse.json(
      { error: "Unable to start checkout. Please try again." },
      { status: 500 },
    );
  }
}
