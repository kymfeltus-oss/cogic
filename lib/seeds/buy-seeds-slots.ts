/** @deprecated Import from `@/lib/seeds/assets` — kept for legacy imports. */
export {
  BUY_SEEDS_CONTINUE_SLOT,
  BUY_SEEDS_DEFAULT_PACKAGE_ID,
  BUY_SEEDS_ERROR_SLOT,
  getSeedPackage as getBuySeedsPackage,
  seedPackages as BUY_SEEDS_PACKAGES,
  type SeedPackageId as BuySeedsPackageId,
  type SeedPackageOverlay as BuySeedsPackage,
} from "@/lib/seeds/assets";

export type BuySeedsOverlayRect = {
  left: string;
  top: string;
  width: string;
  height: string;
};
