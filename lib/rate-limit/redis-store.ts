import "server-only";

import {
  distributedRateLimitRedisUrl,
  isDistributedRateLimitConfigured,
} from "@/lib/rate-limit/config";
import type { RateLimitBucket, RateLimitDecision, RateLimitStore } from "@/lib/rate-limit/types";

export { isDistributedRateLimitConfigured };

type RedisClientLike = {
  incr(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<number>;
  pttl(key: string): Promise<number>;
  quit(): Promise<"OK">;
};

let redisClientPromise: Promise<RedisClientLike | null> | null = null;

function redisUrl(): string {
  return distributedRateLimitRedisUrl(process.env);
}

async function getRedisClient(): Promise<RedisClientLike | null> {
  const url = redisUrl();
  if (!url) return null;

  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      try {
        const { default: Redis } = await import("ioredis");
        const client = new Redis(url, {
          maxRetriesPerRequest: 1,
          enableReadyCheck: true,
          lazyConnect: true,
          connectTimeout: 1500,
        });
        await client.connect();
        return client as unknown as RedisClientLike;
      } catch {
        redisClientPromise = null;
        return null;
      }
    })();
  }

  return redisClientPromise;
}

export class RedisRateLimitStore implements RateLimitStore {
  get configured(): boolean {
    return isDistributedRateLimitConfigured();
  }

  async hit(bucket: RateLimitBucket): Promise<RateLimitDecision> {
    if (!this.configured) {
      return {
        allowed: true,
        enforced: false,
        remaining: null,
        retryAfterSeconds: null,
        reason: "not_configured",
      };
    }

    const client = await getRedisClient();
    if (!client) {
      return {
        allowed: true,
        enforced: false,
        remaining: null,
        retryAfterSeconds: null,
        reason: "store_unavailable",
      };
    }

    const redisKey = `rl:${bucket.key}`;
    try {
      const count = await client.incr(redisKey);
      if (count === 1) {
        await client.pexpire(redisKey, bucket.windowSeconds * 1000);
      }

      const ttlMs = await client.pttl(redisKey);
      const retryAfterSeconds =
        ttlMs > 0 ? Math.max(1, Math.ceil(ttlMs / 1000)) : bucket.windowSeconds;
      const remaining = Math.max(0, bucket.limit - count);

      if (count > bucket.limit) {
        return {
          allowed: false,
          enforced: true,
          remaining: 0,
          retryAfterSeconds,
          reason: "limited",
        };
      }

      return {
        allowed: true,
        enforced: true,
        remaining,
        retryAfterSeconds: null,
      };
    } catch {
      return {
        allowed: true,
        enforced: false,
        remaining: null,
        retryAfterSeconds: null,
        reason: "store_unavailable",
      };
    }
  }
}
