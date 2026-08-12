/**
 * Pure env inspection for distributed rate-limit readiness.
 * Kept free of `server-only` so health readiness unit tests can import it.
 */

export function distributedRateLimitRedisUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (
    env.REDIS_URL?.trim() ||
    env.UPSTASH_REDIS_URL?.trim() ||
    env.RATE_LIMIT_REDIS_URL?.trim() ||
    ""
  );
}

export function isDistributedRateLimitConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return distributedRateLimitRedisUrl(env).length > 0;
}
