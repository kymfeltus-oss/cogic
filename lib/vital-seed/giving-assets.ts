import { MOBILE_ARTBOARD_REF } from "@/lib/responsive";

/** Giving background plates — approved COGIC LIVE assets (`/public/giving/`). */

export const VITAL_SEED_GIVING_ASSET_VERSION = "20260806-1";

export const VITAL_SEED_GIVING_ASSETS = {
  /** Header plate — COGIC Giving artwork (no form panel). */
  mobileBackground: `/giving/giving.png?v=${VITAL_SEED_GIVING_ASSET_VERSION}`,
} as const;

export const VITAL_SEED_GIVING_MOBILE_ART = MOBILE_ARTBOARD_REF;

/**
 * Native header crop — top of `/giving/giving.png`.
 * Stops above form region so taps hit the native form.
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
