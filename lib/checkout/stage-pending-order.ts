import type { SupabaseClient } from "@supabase/supabase-js";
import { SEED_PACK_LEGACY_ORDER_PRODUCT_TYPE } from "@/lib/billing-config";

export type StagePendingOrderInput = {
  userId: string;
  email: string;
  productType: string;
  amountTotalCents: number;
  stripeSessionId: string;
};

export type StagePendingOrderResult = {
  ok: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  productTypeUsed: string;
};

/**
 * Stage a pending Stripe order row before redirecting to Checkout.
 * Uses the legacy seed-pack slug when newer tier slugs fail DB constraints.
 */
export async function stagePendingCheckoutOrder(
  supabase: SupabaseClient,
  input: StagePendingOrderInput,
): Promise<StagePendingOrderResult> {
  const baseRow = {
    user_id: input.userId,
    email: input.email,
    amount_total: input.amountTotalCents,
    status: "pending" as const,
    stripe_session_id: input.stripeSessionId,
  };

  const primary = await supabase.from("orders").insert({
    ...baseRow,
    product_type: input.productType,
  });

  if (!primary.error) {
    return {
      ok: true,
      errorCode: null,
      errorMessage: null,
      productTypeUsed: input.productType,
    };
  }

  const isProductTypeConstraint =
    primary.error.code === "23514" ||
    primary.error.message.toLowerCase().includes("product_type");

  if (
    isProductTypeConstraint &&
    input.productType !== SEED_PACK_LEGACY_ORDER_PRODUCT_TYPE
  ) {
    const fallback = await supabase.from("orders").insert({
      ...baseRow,
      product_type: SEED_PACK_LEGACY_ORDER_PRODUCT_TYPE,
    });

    if (!fallback.error) {
      return {
        ok: true,
        errorCode: null,
        errorMessage: null,
        productTypeUsed: SEED_PACK_LEGACY_ORDER_PRODUCT_TYPE,
      };
    }

    return {
      ok: false,
      errorCode: fallback.error.code ?? null,
      errorMessage: fallback.error.message,
      productTypeUsed: SEED_PACK_LEGACY_ORDER_PRODUCT_TYPE,
    };
  }

  if (isMissingModernOrdersColumn(primary.error.message)) {
    return stageLegacyOrdersRow(supabase, input);
  }

  return {
    ok: false,
    errorCode: primary.error.code ?? null,
    errorMessage: primary.error.message,
    productTypeUsed: input.productType,
  };
}

function isMissingModernOrdersColumn(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("could not find") ||
    (lower.includes("column") &&
      (lower.includes("email") ||
        lower.includes("product_type") ||
        lower.includes("amount_total")))
  );
}

async function stageLegacyOrdersRow(
  supabase: SupabaseClient,
  input: StagePendingOrderInput,
): Promise<StagePendingOrderResult> {
  const legacy = await supabase.from("orders").insert({
    customer_email: input.email,
    product_id: SEED_PACK_LEGACY_ORDER_PRODUCT_TYPE,
    stripe_session_id: input.stripeSessionId,
    status: "pending",
  });

  if (!legacy.error) {
    return {
      ok: true,
      errorCode: null,
      errorMessage: null,
      productTypeUsed: SEED_PACK_LEGACY_ORDER_PRODUCT_TYPE,
    };
  }

  return {
    ok: false,
    errorCode: legacy.error.code ?? null,
    errorMessage: legacy.error.message,
    productTypeUsed: SEED_PACK_LEGACY_ORDER_PRODUCT_TYPE,
  };
}
