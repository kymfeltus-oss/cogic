import { MOBILE_ARTBOARD_REF } from "@/lib/responsive";

/** Vital Seed giving background plates (`/public/images/vital-seed/`). */

export const VITAL_SEED_GIVING_ASSET_VERSION = "20260622-5";

export const VITAL_SEED_GIVING_ASSETS = {
  /** Header-only plate — logo, GIVING lettering, waveforms (no form panel). */
  mobileBackground: `/vital seed/mobile-main-background.png?v=${VITAL_SEED_GIVING_ASSET_VERSION}`,
} as const;

export const VITAL_SEED_GIVING_MOBILE_ART = MOBILE_ARTBOARD_REF;

/**
 * Native header crop — top of `/vital seed/mobile-main-background.png`.
 * Stops above baked preset rows (~53% of full 1672px plate) so taps hit the native form.
 */
export const VITAL_SEED_GIVING_MOBILE_ART_NATIVE = {
  width: 941,
  height: 780,
} as const;

/** Header PNG bottom edge on 1080×1920 stage (object-fit: contain, top). */
export const VITAL_SEED_GIVING_HEADER_STAGE_RATIO =
  VITAL_SEED_GIVING_MOBILE_ART_NATIVE.height /
  VITAL_SEED_GIVING_MOBILE_ART_NATIVE.width /
  (MOBILE_ARTBOARD_REF.height / MOBILE_ARTBOARD_REF.width);

/** Preset gift amounts — native form below the header plate. */
export const givingAmounts = [
  {
    amount: 25,
    label: "SEED",
  },
  {
    amount: 50,
    label: "SOW",
  },
  {
    amount: 100,
    label: "GROW",
  },
  {
    amount: 250,
    label: "FLOURISH",
  },
] as const;

export type GivingAmountCard = (typeof givingAmounts)[number];

/** @deprecated Use givingAmounts */
export const GIVING_AMOUNTS = givingAmounts;
