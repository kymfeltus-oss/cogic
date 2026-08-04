import { MOBILE_ARTBOARD_REF } from "@/lib/responsive";
import { givingAmounts } from "@/lib/vital-seed/giving-assets";

/** Percentage rects aligned to `/public/vital seed/mobile-main-background.png` (941×1000 native). */

export type GivingFrequency = "one_time" | "monthly" | "weekly";

export type GivingOverlayRect = {
  left: string;
  top: string;
  width: string;
  height: string;
};

export type GivingPresetSlot = GivingOverlayRect & {
  amount: number;
  label: string;
};

/** Dashboard stage dimensions — same as home. */
export const GIVING_MOBILE_ART = MOBILE_ARTBOARD_REF;

/** Native PNG plate — top-aligned inside the 1080×1920 stage. */
export const GIVING_MOBILE_ART_NATIVE = {
  width: 941,
  height: 1672,
} as const;

export const GIVING_AMOUNT_PRESETS = givingAmounts.map((entry) => entry.amount);

export const GIVING_MOBILE_DEFAULT_AMOUNT = givingAmounts[0].amount;

/** 2×2 preset amount slots — measured neon button interiors on mobile-main-background.png. */
export const GIVING_MOBILE_PRESET_SLOTS: readonly GivingPresetSlot[] = [
  { amount: 25, label: "SEED", left: "8.2%", top: "52.8%", width: "41.7%", height: "6.2%" },
  { amount: 50, label: "SOW", left: "49.3%", top: "52.8%", width: "40.8%", height: "6.2%" },
  { amount: 100, label: "GROW", left: "8.2%", top: "60.2%", width: "39.1%", height: "6.2%" },
  { amount: 250, label: "FLOURISH", left: "50.8%", top: "60.2%", width: "39.3%", height: "6.2%" },
];

/** “Custom Amount” field on the PNG plate. */
export const GIVING_MOBILE_CUSTOM_AMOUNT_SLOT: GivingOverlayRect = {
  left: "8.2%",
  top: "67.8%",
  width: "81.9%",
  height: "6.8%",
};

export const GIVING_MOBILE_GIVE_NOW_SLOT: GivingOverlayRect = {
  left: "8.2%",
  top: "75.8%",
  width: "82%",
  height: "8.2%",
};

export const GIVING_MOBILE_ERROR_SLOT: GivingOverlayRect = {
  left: "8%",
  top: "66.5%",
  width: "84%",
  height: "2.2%",
};

/** Legacy frequency toggles — not on current mobile art; checkout defaults to one-time. */
export const GIVING_MOBILE_FREQUENCY_SLOTS: ReadonlyArray<
  GivingOverlayRect & { frequency: GivingFrequency; label: string }
> = [] as const;
