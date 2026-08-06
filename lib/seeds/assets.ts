import {
  formatSeedBillingPrice,
  SEED_BILLING_DEFAULT_PACKAGE_ID,
  SEED_PACKAGES,
  type SeedBillingPackageId,
} from "@/lib/billing-config";
import { MOBILE_ARTBOARD_REF } from "@/lib/responsive";

/** Buy Seeds page — flat background + native overlay content. */

export const BUY_SEEDS_ASSET_VERSION = "20260622-9";

export const BUY_SEEDS_ASSETS = {
  mobileBackground: `/giving/giving.png?v=${BUY_SEEDS_ASSET_VERSION}`,
} as const;

export const BUY_SEEDS_MOBILE_ART = MOBILE_ARTBOARD_REF;

/** Native PNG plate — same 1080×1920 stage as attendee dashboard. */
export const BUY_SEEDS_MOBILE_ART_NATIVE = MOBILE_ARTBOARD_REF;

/** Matches `--mobile-tab-content-inset-left` (40 / 1080) — overlay buttons stay here. */
export const BUY_SEEDS_TAB_CONTENT_INSET_PX = 40;

/**
 * Baked UI column on mobile-main-background.png (1080×1920).
 * Balance card + package rows share cols 145–934 (~73%).
 */
export const BUY_SEEDS_BODY_ART_BOUNDS = {
  left: 145,
  right: 934,
  width: 790,
  canvasWidth: 1080,
} as const;

/** Hero waveform is wider (96–983) — scaled with body so tab-column overlays align. */
export const BUY_SEEDS_HERO_ART_BOUNDS = {
  left: 96,
  right: 983,
  width: 888,
  canvasWidth: 1080,
} as const;

/** Scale PNG horizontally so baked body column matches tab-content button width. */
export const BUY_SEEDS_ARTBOARD_WIDTH_SCALE =
  (BUY_SEEDS_BODY_ART_BOUNDS.canvasWidth - 2 * BUY_SEEDS_TAB_CONTENT_INSET_PX) /
  BUY_SEEDS_BODY_ART_BOUNDS.width;

export const BUY_SEEDS_PANEL_INSET_LEFT = `calc(${BUY_SEEDS_TAB_CONTENT_INSET_PX} / ${BUY_SEEDS_BODY_ART_BOUNDS.canvasWidth} * 100%)`;

export const BUY_SEEDS_PANEL_WIDTH = `calc(100% - 2 * ${BUY_SEEDS_TAB_CONTENT_INSET_PX} / ${BUY_SEEDS_BODY_ART_BOUNDS.canvasWidth} * 100%)`;

/** @deprecated Use BUY_SEEDS_MOBILE_ART */
export const BUY_SEEDS_ART = BUY_SEEDS_MOBILE_ART;

export type SeedPackageOverlay = {
  packageId: SeedBillingPackageId;
  productType: string;
  seeds: number;
  badge: string;
  price: string;
};

/** Black mask — hides baked row borders/glow (starts above first neon edge). */
export const BUY_SEEDS_BAKED_CONTROLS_MASK = {
  left: "0%",
  top: "53%",
  width: "100%",
  height: "38%",
} as const;

/** Native package list panel — aligned to four baked row slots on the PNG. */
export const BUY_SEEDS_PACKAGES_PANEL = {
  left: BUY_SEEDS_PANEL_INSET_LEFT,
  top: "54.45%",
  width: BUY_SEEDS_PANEL_WIDTH,
  height: "21.5%",
} as const;

const SEED_PACKAGE_BADGES: Record<SeedBillingPackageId, string> = {
  seeds_100: "POPULAR",
  seeds_300: "SAVE 10%",
  seeds_600: "SAVE 20%",
  seeds_1200: "BEST VALUE",
};

/** Native package rows — text rendered in React over masked PNG slots. */
export const seedPackages: ReadonlyArray<SeedPackageOverlay> = SEED_PACKAGES.map((pkg) => ({
  packageId: pkg.id,
  productType: pkg.productType,
  seeds: pkg.count,
  badge: SEED_PACKAGE_BADGES[pkg.id],
  price: formatSeedBillingPrice(pkg.price),
}));

export type SeedPackageId = SeedBillingPackageId;

export const BUY_SEEDS_DEFAULT_PACKAGE_ID: SeedPackageId = SEED_BILLING_DEFAULT_PACKAGE_ID;

export const BUY_SEEDS_CONTINUE_SLOT = {
  label: "Continue to payment",
  left: BUY_SEEDS_PANEL_INSET_LEFT,
  top: "79.65%",
  width: BUY_SEEDS_PANEL_WIDTH,
  height: "6.2%",
} as const;

export const BUY_SEEDS_ERROR_SLOT = {
  left: BUY_SEEDS_PANEL_INSET_LEFT,
  top: "77.95%",
  width: BUY_SEEDS_PANEL_WIDTH,
  height: "1.6%",
} as const;

export function getSeedPackage(packageId: string): SeedPackageOverlay | undefined {
  return seedPackages.find((entry) => entry.packageId === packageId);
}
