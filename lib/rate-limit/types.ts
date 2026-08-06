export type RateLimitDecision = {
  allowed: boolean;
  /** True when a distributed store enforced the decision. */
  enforced: boolean;
  remaining: number | null;
  retryAfterSeconds: number | null;
  reason?: "limited" | "store_unavailable" | "not_configured";
};

export type RateLimitBucket = {
  /** Stable, non-sensitive bucket key (already hashed where needed). */
  key: string;
  limit: number;
  windowSeconds: number;
};

export interface RateLimitStore {
  readonly configured: boolean;
  hit(bucket: RateLimitBucket): Promise<RateLimitDecision>;
}
