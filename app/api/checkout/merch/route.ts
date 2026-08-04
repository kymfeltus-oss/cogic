import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getEventTicketTier,
  getMerchCheckoutPaths,
  getMerchPriceCents,
  getMerchProduct,
  isEventTicketTierId,
  isValidMerchSize,
  resolveMerchLineItemName,
} from "@/lib/merch/catalog";
import {
  getAppUrl,
  getStripeSecretKey,
  resolveAuthenticatedBuyer,
} from "@/lib/checkout/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type MerchCheckoutBody = {
  productId?: string;
  selectedSize?: string | null;
};

type ResolvedCheckoutLineItem = {
  lineItemName: string;
  description: string;
  amountCents: number;
  requiresSize: boolean;
};

function resolveCheckoutLineItem(
  productId: string,
  selectedSize: string,
): ResolvedCheckoutLineItem | null {
  if (isEventTicketTierId(productId)) {
    const ticketTier = getEventTicketTier(productId);

    if (!ticketTier?.hasAccess) {
      return null;
    }

    const seedLabel =
      ticketTier.seedBonus > 0
        ? ` Includes ${ticketTier.seedBonus.toLocaleString("en-US")} Vital Seeds.`
        : "";

    return {
      lineItemName: ticketTier.name,
      description: `300 Awakening virtual concert stream access.${seedLabel}`,
      amountCents: ticketTier.priceInCents,
      requiresSize: false,
    };
  }

  const product = getMerchProduct(productId);

  if (!product) {
    return null;
  }

  return {
    lineItemName: resolveMerchLineItemName(product, selectedSize),
    description: product.description,
    amountCents: getMerchPriceCents(product),
    requiresSize: product.requiresSize,
  };
}

/**
 * Merch + event ticket + live-pass checkout.
 *
 * Security model:
 * - Buyer identity (email, user_id) is resolved ONLY from verified Supabase session cookies.
 * - Request body accepts productId + selectedSize only — never customerEmail or identity fields.
 * - Prices are read from lib/merch/catalog.ts (server source of truth).
 * - Stripe session metadata is stamped server-side for tamper-proof webhook reconciliation.
 *
 * Webhook follow-up (app/api/webhooks/stripe/route.ts):
 * - On checkout.session.completed, reconcile orders by stripe_session_id (Stripe-signed).
 * - Read session.client_reference_id and session.metadata.user_id / metadata.email
 *   for audit cross-checks — never trust any client-supplied email at webhook time.
 * - attendees rows are provisioned via auth signup (handle_new_user trigger), not checkout.
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

    const body = (await request.json()) as MerchCheckoutBody;
    const productId = body.productId?.trim();
    const selectedSize = body.selectedSize?.trim() || "N/A";

    if (!productId) {
      return NextResponse.json({ error: "Product is required." }, { status: 400 });
    }

    const lineItem = resolveCheckoutLineItem(productId, selectedSize);

    if (!lineItem) {
      return NextResponse.json({ error: "Invalid product." }, { status: 400 });
    }

    if (lineItem.requiresSize && !isValidMerchSize(selectedSize)) {
      return NextResponse.json(
        { error: "A valid size is required for this item." },
        { status: 400 },
      );
    }

    const { successPath, cancelPath } = getMerchCheckoutPaths(productId);
    const appUrl = getAppUrl(request);
    const stripe = new Stripe(stripeSecretKey);

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
            unit_amount: lineItem.amountCents,
            product_data: {
              name: lineItem.lineItemName,
              description: lineItem.description,
            },
          },
        },
      ],
      metadata: {
        checkout_type: isEventTicketTierId(productId) ? "ticket" : "merch",
        product_id: productId,
        product_type: productId,
        selected_size: selectedSize,
        user_id: buyer.userId,
        email: buyer.email,
      },
      success_url: `${appUrl}${successPath}`,
      cancel_url: `${appUrl}${cancelPath}`,
    });

    const supabase = getSupabaseAdmin();
    const { error: insertError } = await supabase.from("orders").insert({
      user_id: buyer.userId,
      email: buyer.email,
      product_type: productId,
      amount_total: lineItem.amountCents,
      status: "pending",
      stripe_session_id: session.id,
    });

    if (insertError) {
      console.error("Failed to stage order record:", insertError.message);
      return NextResponse.json(
        { error: "Unable to initialize order record." },
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
    console.error("Merch checkout session error:", error);
    return NextResponse.json(
      { error: "Unable to start checkout. Please try again." },
      { status: 500 },
    );
  }
}
