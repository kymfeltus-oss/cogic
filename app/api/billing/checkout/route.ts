import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getSeedBillingPackage,
  resolveSeedStripePriceId,
  seedBillingPriceCents,
} from "@/lib/billing-config";
import {
  formatStripeCheckoutError,
  getAppUrl,
  getStripeSecretKey,
  resolveAuthenticatedBuyer,
} from "@/lib/checkout/server";
import { stagePendingCheckoutOrder } from "@/lib/checkout/stage-pending-order";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type SeedCheckoutBody = {
  packageId?: string;
};

/**
 * Vital Seed bundle checkout — always available (no event phase / live-signal gate).
 * Uses configured Stripe Price IDs when present; otherwise falls back to server-side price_data.
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

    const auth = await resolveAuthenticatedBuyer(request);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { buyer, withSessionCookies } = auth;
    const body = (await request.json()) as SeedCheckoutBody;
    const packageId = body.packageId?.trim();

    if (!packageId) {
      return NextResponse.json(
        { error: "A seed package selection is required." },
        { status: 400 },
      );
    }

    const targetPack = getSeedBillingPackage(packageId);

    if (!targetPack) {
      return NextResponse.json(
        { error: "Invalid seed bundle package selection." },
        { status: 400 },
      );
    }

    const stripePriceId = resolveSeedStripePriceId(targetPack);
    const amountCents = seedBillingPriceCents(targetPack);

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = stripePriceId
      ? [{ price: stripePriceId, quantity: 1 }]
      : [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: amountCents,
              product_data: {
                name: `${targetPack.count.toLocaleString("en-US")} Vital Seeds`,
                description: `300 Awakening seed bundle — ${targetPack.count.toLocaleString("en-US")} seeds for the live experience.`,
              },
            },
          },
        ];

    const appUrl = getAppUrl(request);
    const stripe = new Stripe(stripeSecretKey);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "link"],
      client_reference_id: buyer.userId,
      customer_email: buyer.email,
      line_items: lineItems,
      metadata: {
        checkout_type: "seed_pack",
        package_id: targetPack.id,
        product_id: targetPack.productType,
        product_type: targetPack.productType,
        seed_count: String(targetPack.count),
        user_id: buyer.userId,
        email: buyer.email,
      },
      success_url: `${appUrl}/buy-seeds?success=true`,
      cancel_url: `${appUrl}/buy-seeds?canceled=true`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Unable to create checkout session." },
        { status: 500 },
      );
    }

    const supabase = getSupabaseAdmin();
    const staged = await stagePendingCheckoutOrder(supabase, {
      userId: buyer.userId,
      email: buyer.email,
      productType: targetPack.productType,
      amountTotalCents: amountCents,
      stripeSessionId: session.id,
    });

    if (!staged.ok) {
      console.error("Failed to stage seed order record:", staged.errorMessage);
      return NextResponse.json(
        {
          error:
            "Unable to initialize order record. If this persists, contact support — your card was not charged.",
        },
        { status: 500 },
      );
    }

    return withSessionCookies(NextResponse.json({ url: session.url }));
  } catch (error) {
    console.error("Seed billing checkout session error:", error);
    return NextResponse.json(
      { error: formatStripeCheckoutError(error) },
      { status: 500 },
    );
  }
}
