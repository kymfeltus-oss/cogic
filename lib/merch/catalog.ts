import { EXPERIENCE_LIVE_PATH } from "@/lib/experience/live-routes";

export type MerchProduct = {
  id: string;
  title: string;
  description: string;
  price: number;
  image: string;
  requiresSize: boolean;
  category: string;
  badge?: string;
};

export const MERCH_PRODUCTS: readonly MerchProduct[] = [
  {
    id: "cd-preorder",
    title: "Live Album Pre-Order",
    description:
      "Reserve the official COGIC LIVE recording before release night.",
    price: 20,
    image: "/my-sanctuary/banner.png",
    requiresSize: false,
    category: "Music",
    badge: "Pre-Order",
  },
  {
    id: "concert-tee",
    title: "COGIC LIVE Concert Tee",
    description:
      "Matte black event tee with the official COGIC LIVE crest print.",
    price: 25,
    image: "/my-sanctuary/cogic-live-logo.png",
    requiresSize: true,
    category: "Apparel",
    badge: "Best Seller",
  },
  {
    id: "choir-hoodie",
    title: "The Sound of Healing Hoodie",
    description:
      "Premium heavyweight hoodie honoring COGIC LIVE worship and choir legacy.",
    price: 50,
    image: "/branding/cogic-seal.png",
    requiresSize: true,
    category: "Apparel",
  },
  {
    id: "live-pass",
    title: "Virtual Live Stream Ticket",
    description:
      "Full digital access to the COGIC LIVE broadcast stream.",
    price: 10,
    image: "/my-sanctuary/cogic-live-logo.png",
    requiresSize: false,
    category: "Access",
    badge: "Live",
  },
  {
    id: "seed-pack-sower",
    title: "Sower Seed Pack",
    description:
      "100 seeds to shower the stage with praise emotes during the live broadcast.",
    price: 5,
    image: "/my-sanctuary/cogic-live-logo.png",
    requiresSize: false,
    category: "Seeds",
    badge: "Starter",
  },
  {
    id: "seed-pack-harvest",
    title: "Harvest Seed Pack",
    description:
      "350 seeds for sustained live-room interaction and premium animated emotes.",
    price: 15,
    image: "/branding/cogic-seal.png",
    requiresSize: false,
    category: "Seeds",
    badge: "Popular",
  },
  {
    id: "seed-pack-golden",
    title: "Golden Harvest Pack",
    description:
      "800 seeds — unlock the full Golden Harvest emote arsenal for the entire broadcast.",
    price: 30,
    image: "/my-sanctuary/banner.png",
    requiresSize: false,
    category: "Seeds",
    badge: "Best Value",
  },
] as const;

export const MERCH_SIZES = ["S", "M", "L", "XL", "2XL"] as const;

export type MerchSize = (typeof MERCH_SIZES)[number];

export const LIVE_PASS_PRODUCT_ID = "live-pass";

export type EventTicketTier = {
  id: string;
  name: string;
  priceInCents: number;
  hasAccess: boolean;
  seedBonus: number;
};

export const EVENT_TICKET_TIERS: readonly EventTicketTier[] = [
  {
    id: "ticket-tier-basic",
    name: "General Admission Pass",
    priceInCents: 1000,
    hasAccess: true,
    seedBonus: 0,
  },
  {
    id: "ticket-tier-pro",
    name: "Pro Pass (+500 Seeds Bundle)",
    priceInCents: 1499,
    hasAccess: true,
    seedBonus: 500,
  },
  {
    id: "ticket-tier-vip",
    name: "VIP Access (+1,500 Seeds Mega-Bundle)",
    priceInCents: 2499,
    hasAccess: true,
    seedBonus: 1500,
  },
] as const;

export const EVENT_TICKET_TIER_IDS = EVENT_TICKET_TIERS.map(
  (tier) => tier.id,
) as readonly string[];

export function isEventTicketTierId(productId: string): boolean {
  return (EVENT_TICKET_TIER_IDS as readonly string[]).includes(productId);
}

export function getEventTicketTier(
  productId: string,
): EventTicketTier | undefined {
  return EVENT_TICKET_TIERS.find((tier) => tier.id === productId);
}

export function formatTicketPriceCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** Retail cost to buy seed packs separately (greedy largest-pack fill). */
export function computeSeedBonusRetailCents(seedBonus: number): number {
  if (seedBonus <= 0) return 0;

  let remaining = seedBonus;
  let totalCents = 0;
  const packs = [...SEED_ECONOMY_PACKS].sort(
    (a, b) => b.seedAmount - a.seedAmount,
  );

  while (remaining > 0) {
    const pack =
      packs.find((entry) => entry.seedAmount <= remaining) ??
      packs[packs.length - 1]!;
    totalCents += Math.round(pack.price * 100);
    remaining -= pack.seedAmount;
  }

  return totalCents;
}

export function computeTicketTierSeparateTotalCents(tier: EventTicketTier): number {
  const basicAccess = EVENT_TICKET_TIERS[0]!;
  return basicAccess.priceInCents + computeSeedBonusRetailCents(tier.seedBonus);
}

export function computeTicketTierSavingsCents(tier: EventTicketTier): number {
  return Math.max(0, computeTicketTierSeparateTotalCents(tier) - tier.priceInCents);
}

export function getTicketTierShortLabel(tierId: string): string {
  switch (tierId) {
    case "ticket-tier-basic":
      return "General Admission";
    case "ticket-tier-pro":
      return "Pro Pass";
    case "ticket-tier-vip":
      return "VIP Access";
    default:
      return getEventTicketTier(tierId)?.name ?? "Live Pass";
  }
}

/** Paid product ids that unlock the HLS live stream (tiers + legacy live-pass). */
export const LIVE_STREAM_ACCESS_PRODUCT_IDS = [
  ...EVENT_TICKET_TIER_IDS,
  LIVE_PASS_PRODUCT_ID,
] as const;

export type SeedEconomyPack = {
  productId: string;
  title: string;
  description: string;
  seedAmount: number;
  price: number;
  badge?: string;
};

export const SEED_ECONOMY_PACKS: readonly SeedEconomyPack[] = [
  {
    productId: "seed-pack-sower",
    title: "Sower Pack",
    description: "100 seeds to fuel your first wave of stage love.",
    seedAmount: 100,
    price: 5,
    badge: "Starter",
  },
  {
    productId: "seed-pack-harvest",
    title: "Harvest Pack",
    description: "350 seeds for sustained premium emote showers.",
    seedAmount: 350,
    price: 15,
    badge: "Popular",
  },
  {
    productId: "seed-pack-golden",
    title: "Golden Harvest",
    description: "800 seeds — the ultimate concert interaction arsenal.",
    seedAmount: 800,
    price: 30,
    badge: "Best Value",
  },
] as const;

export const SEED_PACK_PRODUCT_IDS = [
  ...SEED_ECONOMY_PACKS.map((pack) => pack.productId),
  "seed-pack-100",
  "seed-pack-300",
  "seed-pack-600",
  "seed-pack-1200",
] as const;

export function isSeedPackProductId(productId: string): boolean {
  return (SEED_PACK_PRODUCT_IDS as readonly string[]).includes(productId);
}

export function getSeedPackCredit(productId: string): number {
  return SEED_ECONOMY_PACKS.find((pack) => pack.productId === productId)
    ?.seedAmount ?? 0;
}

export function getMerchProduct(productId: string): MerchProduct | undefined {
  return MERCH_PRODUCTS.find((product) => product.id === productId);
}

export function getMerchPriceCents(product: MerchProduct): number {
  return Math.round(product.price * 100);
}

export function isValidMerchSize(size: string): size is MerchSize {
  return (MERCH_SIZES as readonly string[]).includes(size);
}

export function resolveMerchLineItemName(
  product: MerchProduct,
  selectedSize: string,
): string {
  if (product.requiresSize && selectedSize !== "N/A") {
    return `${product.title} — Size ${selectedSize}`;
  }
  return product.title;
}

export function getMerchCheckoutPaths(productId: string): {
  successPath: string;
  cancelPath: string;
} {
  if (productId === LIVE_PASS_PRODUCT_ID || isEventTicketTierId(productId)) {
    return {
      successPath: `${EXPERIENCE_LIVE_PATH}?success=true`,
      cancelPath: `${EXPERIENCE_LIVE_PATH}?canceled=true`,
    };
  }

  if (isSeedPackProductId(productId)) {
    return {
      successPath: `${EXPERIENCE_LIVE_PATH}?payment=success`,
      cancelPath: `${EXPERIENCE_LIVE_PATH}?payment=cancelled`,
    };
  }

  return {
    successPath: "/dashboard/merch?success=true",
    cancelPath: "/dashboard/merch?canceled=true",
  };
}

export function formatMerchPrice(dollars: number): string {
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
