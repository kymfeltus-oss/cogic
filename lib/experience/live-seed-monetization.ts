/** Server + client constants for live-room seed sow monetization. */

export const LIVE_SOW_FREE_TAP_LIMIT = 3;
export const LIVE_SOW_SEED_COST = 1;
export const LIVE_SOW_CHAT_MESSAGE = "sowed a seed on stage";

export type SowSeedBilling = {
  freeTapsConsumed: number;
  seedCost: number;
};

/** Authoritative billing split for one sow action. */
export function resolveSowSeedBilling(usedFreeTaps: number): SowSeedBilling {
  if (usedFreeTaps < LIVE_SOW_FREE_TAP_LIMIT) {
    return { freeTapsConsumed: 1, seedCost: 0 };
  }

  return { freeTapsConsumed: 0, seedCost: LIVE_SOW_SEED_COST };
}

export function formatSowSeedCostLabel(usedFreeTaps: number): string {
  const billing = resolveSowSeedBilling(usedFreeTaps);
  if (billing.seedCost === 0) {
    const remaining = LIVE_SOW_FREE_TAP_LIMIT - usedFreeTaps;
    return `Free · ${remaining} left`;
  }
  return `${billing.seedCost} seed${billing.seedCost === 1 ? "" : "s"}`;
}
