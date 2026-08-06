import {
  HARVEST_GOAL_DOLLARS,
  formatHarvestCurrency,
} from "@/lib/live/harvest-metrics";

export { HARVEST_GOAL_DOLLARS, formatHarvestCurrency };

export type ContributionStatus = "paid" | "pending" | "processing";

export type ContributionEntry = {
  id: string;
  date: string;
  label: string;
  amount: number;
  status: ContributionStatus;
  channel: "stripe" | "seed" | "network";
};

export type NetworkMilestone = {
  id: string;
  label: string;
  current: number;
  target: number;
  unit: "usd" | "sowers" | "sessions";
};

export type NetworkGauge = {
  id: string;
  label: string;
  value: number;
  max: number;
  accent: "blue" | "magenta";
};

/** Legacy mock datasets removed — never invent contribution or network stats for UI. */
export const MOCK_PERSONAL_CONTRIBUTIONS: readonly ContributionEntry[] = [];

export const MOCK_NETWORK_STATS = {
  activeSowers: 0,
  sessionsThisWeek: 0,
  averageGift: 0,
} as const;

/** Harvest totals are supplied live via `useHarvestMetrics` when wired. */
export const LIVE_HARVEST_MILESTONE_ID = "m-1";

export const MOCK_NETWORK_MILESTONES: readonly NetworkMilestone[] = [];

export const MOCK_NETWORK_GAUGES: readonly NetworkGauge[] = [];

export function sumPersonalContributions(
  entries: readonly ContributionEntry[],
): number {
  return entries
    .filter((entry) => entry.status === "paid")
    .reduce((sum, entry) => sum + entry.amount, 0);
}

export function formatContributionStatus(status: ContributionStatus): string {
  switch (status) {
    case "paid":
      return "Confirmed";
    case "pending":
      return "Pending";
    case "processing":
      return "Processing";
  }
}
