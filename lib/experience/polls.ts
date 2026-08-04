/** Interactive audience poll types (live_polls / live_poll_votes). */

export const LIVE_POLL_CHOICES = ["A", "B"] as const;

export type LivePollChoice = (typeof LIVE_POLL_CHOICES)[number];

export type LivePollRow = {
  id: string;
  question: string;
  option_a: string;
  option_b: string;
  is_active: boolean;
  created_at: string;
};

export type LivePollPublic = {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
};

export type LivePollTotals = {
  countA: number;
  countB: number;
};

export type LivePollSession = {
  authenticated: boolean;
  canVote: boolean;
};

export type LivePollPayload = {
  poll: LivePollPublic | null;
  totals: LivePollTotals;
  userVote: LivePollChoice | null;
  session: LivePollSession;
};

export function isLivePollChoice(value: unknown): value is LivePollChoice {
  return value === "A" || value === "B";
}

export function mapLivePollRow(row: LivePollRow): LivePollPublic {
  return {
    id: row.id,
    question: row.question,
    optionA: row.option_a,
    optionB: row.option_b,
  };
}

export function computePollPercentages(totals: LivePollTotals): {
  percentA: number;
  percentB: number;
} {
  const total = totals.countA + totals.countB;
  if (total <= 0) {
    return { percentA: 0, percentB: 0 };
  }

  const percentA = Math.round((totals.countA / total) * 100);
  return { percentA, percentB: 100 - percentA };
}
