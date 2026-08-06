import type { GivingFund, GivingFundKey } from "@/lib/giving/types";

/**
 * Active COGIC Giving funds.
 * No fund table exists yet — configuration is application-owned until a ledger
 * designation schema is introduced. Keys are stamped into Stripe metadata only.
 */
export const COGIC_GIVING_FUNDS: readonly GivingFund[] = [
  {
    key: "tithes",
    label: "Tithes",
    description: "Tithes",
    active: true,
    sortOrder: 1,
  },
  {
    key: "offering",
    label: "Offering",
    description: "Offering",
    active: true,
    sortOrder: 2,
  },
  {
    key: "missions",
    label: "Missions",
    description: "Missions",
    active: true,
    sortOrder: 3,
  },
  {
    key: "general_fund",
    label: "General Fund",
    description: "General Fund",
    active: true,
    sortOrder: 4,
  },
] as const;

export const DEFAULT_GIVING_FUND_KEY: GivingFundKey = "tithes";

export function listActiveGivingFunds(): GivingFund[] {
  return COGIC_GIVING_FUNDS.filter((fund) => fund.active).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

export function getGivingFund(key: string | null | undefined): GivingFund | null {
  if (!key) return null;
  return listActiveGivingFunds().find((fund) => fund.key === key) ?? null;
}

export function isActiveGivingFundKey(key: string): key is GivingFundKey {
  return getGivingFund(key) != null;
}
