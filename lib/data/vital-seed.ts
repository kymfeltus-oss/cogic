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

export const MOCK_PERSONAL_CONTRIBUTIONS: readonly ContributionEntry[] = [
  {
    id: "c-1",
    date: "2026-06-01",
    label: "Frequency Seed Transmission",
    amount: 50,
    status: "paid",
    channel: "stripe",
  },
  {
    id: "c-2",
    date: "2026-05-18",
    label: "Breakthrough Wave Offering",
    amount: 100,
    status: "paid",
    channel: "seed",
  },
  {
    id: "c-3",
    date: "2026-05-04",
    label: "Vital Sound Network Relay",
    amount: 25,
    status: "paid",
    channel: "network",
  },
  {
    id: "c-4",
    date: "2026-06-06",
    label: "Live Night Blessing",
    amount: 75,
    status: "processing",
    channel: "stripe",
  },
] as const;

export const MOCK_NETWORK_STATS = {
  activeSowers: 1_284,
  sessionsThisWeek: 312,
  averageGift: 38,
} as const;

/** Awakening harvest totals are supplied live via `useHarvestMetrics`. */
export const LIVE_HARVEST_MILESTONE_ID = "m-1";

export const MOCK_NETWORK_MILESTONES: readonly NetworkMilestone[] = [
  {
    id: "m-2",
    label: "Network Sowers",
    current: 1_284,
    target: 2_000,
    unit: "sowers",
  },
  {
    id: "m-3",
    label: "Live Session Reach",
    current: 312,
    target: 500,
    unit: "sessions",
  },
] as const;

export const MOCK_NETWORK_GAUGES: readonly NetworkGauge[] = [
  { id: "g-1", label: "Weekly Momentum", value: 72, max: 100, accent: "blue" },
  { id: "g-2", label: "Community Resonance", value: 86, max: 100, accent: "magenta" },
  { id: "g-3", label: "Seed Retention", value: 64, max: 100, accent: "blue" },
] as const;

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
