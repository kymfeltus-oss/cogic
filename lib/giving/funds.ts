import type { GivingFund, GivingFundKey } from "@/lib/giving/types";

/**
 * Seed fund designations used only for migration/tests.
 * Production authority is `public.giving_funds` via lib/giving/repository.ts.
 */
export const SEED_GIVING_FUNDS: readonly GivingFund[] = [
  {
    key: "tithes",
    label: "Tithes",
    description: "Tithes",
    active: true,
    published: true,
    sortOrder: 1,
  },
  {
    key: "offering",
    label: "Offering",
    description: "Offering",
    active: true,
    published: true,
    sortOrder: 2,
  },
  {
    key: "missions",
    label: "Missions",
    description: "Missions",
    active: true,
    published: true,
    sortOrder: 3,
  },
  {
    key: "general_fund",
    label: "General Fund",
    description: "General Fund",
    active: true,
    published: true,
    sortOrder: 4,
  },
] as const;

export const DEFAULT_GIVING_FUND_KEY: GivingFundKey = "tithes";

export function sortGivingFunds(funds: readonly GivingFund[]): GivingFund[] {
  return [...funds].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

export function listActiveGivingFundsFrom(funds: readonly GivingFund[]): GivingFund[] {
  return sortGivingFunds(
    funds.filter((fund) => fund.active && fund.published !== false),
  );
}

export function getGivingFundFrom(
  funds: readonly GivingFund[],
  key: string | null | undefined,
): GivingFund | null {
  if (!key) return null;
  return listActiveGivingFundsFrom(funds).find((fund) => fund.key === key) ?? null;
}

export function isActiveGivingFundKeyIn(
  funds: readonly GivingFund[],
  key: string,
): key is GivingFundKey {
  return getGivingFundFrom(funds, key) != null;
}

/** @deprecated Prefer listActiveGivingFundsFrom with DB-loaded funds. Seed for tests only. */
export function listActiveGivingFunds(): GivingFund[] {
  return listActiveGivingFundsFrom(SEED_GIVING_FUNDS);
}

/** @deprecated Prefer getGivingFundFrom with DB-loaded funds. Seed for tests only. */
export function getGivingFund(key: string | null | undefined): GivingFund | null {
  return getGivingFundFrom(SEED_GIVING_FUNDS, key);
}

/** @deprecated Prefer isActiveGivingFundKeyIn with DB-loaded funds. Seed for tests only. */
export function isActiveGivingFundKey(key: string): key is GivingFundKey {
  return isActiveGivingFundKeyIn(SEED_GIVING_FUNDS, key);
}
