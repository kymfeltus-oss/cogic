/** Stripe Checkout seed bundles — server source of truth for pricing + fulfillment mapping. */

export type SeedBillingPackageId =
  | "seeds_100"
  | "seeds_300"
  | "seeds_600"
  | "seeds_1200";

export type SeedBillingPackage = {
  /** Client-facing package id sent to `/api/billing/checkout`. */
  id: SeedBillingPackageId;
  count: number;
  /** USD retail price (display + pending-order staging). */
  price: number;
  /** `orders.product_type` + webhook fulfillment key. */
  productType: string;
  /** Env var holding the Stripe Price ID (`price_…`). */
  stripePriceEnv: string;
};

export const SEED_PACKAGES: readonly SeedBillingPackage[] = [
  {
    id: "seeds_100",
    count: 100,
    price: 1.99,
    productType: "seed-pack-100",
    stripePriceEnv: "STRIPE_PRICE_SEEDS_100",
  },
  {
    id: "seeds_300",
    count: 300,
    price: 4.99,
    productType: "seed-pack-300",
    stripePriceEnv: "STRIPE_PRICE_SEEDS_300",
  },
  {
    id: "seeds_600",
    count: 600,
    price: 8.99,
    productType: "seed-pack-600",
    stripePriceEnv: "STRIPE_PRICE_SEEDS_600",
  },
  {
    id: "seeds_1200",
    count: 1200,
    price: 15.99,
    productType: "seed-pack-1200",
    stripePriceEnv: "STRIPE_PRICE_SEEDS_1200",
  },
] as const;

export const SEED_BILLING_DEFAULT_PACKAGE_ID: SeedBillingPackageId = "seeds_100";

/**
 * Legacy slug always allowed by orders_product_type_check on deployed DBs.
 * New tiers (seed-pack-100, etc.) are stored in Stripe metadata; webhook credits
 * the full seed_count from metadata.
 */
export const SEED_PACK_LEGACY_ORDER_PRODUCT_TYPE = "seed-pack-sower" as const;

/** Seeds auto-credited by fulfill_stripe_checkout_session for the legacy slug. */
export const SEED_PACK_LEGACY_ORDER_BASE_CREDIT = 100;

export function parseSeedPackCheckoutCount(
  metadata: Record<string, string | undefined> | null | undefined,
): number {
  const raw = metadata?.seed_count?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function getSeedBillingPackage(
  packageId: string,
): SeedBillingPackage | undefined {
  return SEED_PACKAGES.find((entry) => entry.id === packageId);
}

/** True when env holds a real Stripe Price ID (not .env.example placeholders). */
export function isUsableStripePriceId(value: string | null | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed.startsWith("price_")) return false;
  if (/your_|placeholder|example|price_id/i.test(trimmed)) return false;
  // Stripe price IDs are much longer than placeholder strings like price_your_100_seeds_price_id
  if (trimmed.length < 24) return false;
  return true;
}

/** Resolve configured Stripe Price ID for a package (server-only). */
export function resolveSeedStripePriceId(pkg: SeedBillingPackage): string | null {
  const value = process.env[pkg.stripePriceEnv]?.trim();
  return isUsableStripePriceId(value) ? value : null;
}

export function seedBillingPriceCents(pkg: SeedBillingPackage): number {
  return Math.round(pkg.price * 100);
}

export function formatSeedBillingPrice(price: number): string {
  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
