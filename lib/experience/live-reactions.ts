/** Attendee live reaction types (stored in live_stream_reactions.reaction_type). */

export const LIVE_REACTION_TYPES = [
  "fire",
  "praise",
  "heart",
  "pray",
  "seed",
] as const;

export type LiveReactionType = (typeof LIVE_REACTION_TYPES)[number];

export type LiveReactionDefinition = {
  type: LiveReactionType;
  label: string;
  emoji: string;
};

export const LIVE_REACTION_CATALOG: readonly LiveReactionDefinition[] = [
  { type: "fire", label: "Fire", emoji: "🔥" },
  { type: "praise", label: "Praise", emoji: "🙌" },
  { type: "heart", label: "Heart", emoji: "❤️" },
  { type: "pray", label: "Pray", emoji: "🙏" },
  { type: "seed", label: "Seed", emoji: "🌱" },
] as const;

export const MAX_FLOATING_LIVE_REACTIONS = 25;
export const LIVE_REACTION_CLIENT_COOLDOWN_MS = 500;
export const LIVE_REACTION_RATE_WINDOW_MS = 10_000;
export const LIVE_REACTION_RATE_MAX_PER_WINDOW = 8;
export const LIVE_REACTION_MIN_INTERVAL_MS = 500;
export const LIVE_REACTION_RETENTION_MS = 2 * 60 * 60 * 1_000;

export type LiveReactionRow = {
  id: string;
  user_id: string | null;
  reaction_type: LiveReactionType;
  created_at: string;
};

export type FloatingLiveReaction = {
  key: string;
  emoji: string;
  originX: number;
};

export function isLiveReactionType(value: unknown): value is LiveReactionType {
  return (
    value === "fire" ||
    value === "praise" ||
    value === "heart" ||
    value === "pray" ||
    value === "seed"
  );
}

export function getLiveReactionEmoji(type: LiveReactionType): string {
  const match = LIVE_REACTION_CATALOG.find((entry) => entry.type === type);
  return match?.emoji ?? "✨";
}

export function randomReactionOriginX(): number {
  return 0.12 + Math.random() * 0.76;
}
