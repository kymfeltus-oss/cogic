import { getMerchProduct } from "@/lib/merch/catalog";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HARVEST_GOAL_DOLLARS } from "@/lib/live/types";

export { HARVEST_GOAL_DOLLARS };

export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function formatHarvestCurrency(dollars: number): string {
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function computeHarvestProgressPercent(
  totalDollars: number,
  goalDollars: number = HARVEST_GOAL_DOLLARS,
): number {
  if (goalDollars <= 0) return 0;
  return Math.min(100, (totalDollars / goalDollars) * 100);
}

/** Sum paid order ledger totals (amount_total stored in cents). */
export async function sumPaidOrdersCents(
  supabase: SupabaseClient,
): Promise<number> {
  const { data, error } = await supabase
    .from("orders")
    .select("amount_total, product_type")
    .eq("status", "paid");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reduce((sum, row) => {
    if (typeof row.amount_total === "number" && row.amount_total > 0) {
      return sum + row.amount_total;
    }

    const product = getMerchProduct(row.product_type ?? "");
    return sum + (product ? Math.round(product.price * 100) : 0);
  }, 0);
}

/** Read the singleton harvest_progress row maintained by DB trigger. */
export async function fetchHarvestProgressCents(
  supabase: SupabaseClient,
): Promise<number> {
  const { data, error } = await supabase
    .from("harvest_progress")
    .select("total_cents")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (typeof data?.total_cents === "number") {
    return data.total_cents;
  }

  return sumPaidOrdersCents(supabase);
}
