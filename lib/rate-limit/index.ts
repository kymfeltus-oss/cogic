import "server-only";

import { createHash } from "node:crypto";
import { hashRateLimitIdentifier } from "@/lib/rate-limit/hash";
import {
  isDistributedRateLimitConfigured,
  RedisRateLimitStore,
} from "@/lib/rate-limit/redis-store";
import type { RateLimitDecision } from "@/lib/rate-limit/types";

const store = new RedisRateLimitStore();

/** Credential ingress: tighter window against token probing. */
const CREDENTIAL_INGRESS_LIMIT = 40;
const CREDENTIAL_INGRESS_WINDOW_SECONDS = 60;

/** Checkout creation: protect repeated attempts per authenticated identity. */
const CHECKOUT_LIMIT = 8;
const CHECKOUT_WINDOW_SECONDS = 600;

export { isDistributedRateLimitConfigured };

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function bucketKey(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 40);
}

export async function enforceCredentialIngressRateLimit(
  request: Request,
): Promise<RateLimitDecision> {
  const ipHash = hashRateLimitIdentifier(clientIpFromRequest(request));
  return store.hit({
    key: bucketKey(["credential-ingress", ipHash]),
    limit: CREDENTIAL_INGRESS_LIMIT,
    windowSeconds: CREDENTIAL_INGRESS_WINDOW_SECONDS,
  });
}

export async function enforceRegistrationCheckoutRateLimit(
  request: Request,
  userId: string,
): Promise<RateLimitDecision> {
  const ipHash = hashRateLimitIdentifier(clientIpFromRequest(request));
  const userHash = hashRateLimitIdentifier(userId);
  return store.hit({
    key: bucketKey(["registration-checkout", userHash, ipHash]),
    limit: CHECKOUT_LIMIT,
    windowSeconds: CHECKOUT_WINDOW_SECONDS,
  });
}

export function rateLimitResponseHeaders(decision: RateLimitDecision): HeadersInit {
  const headers: Record<string, string> = {};
  if (decision.retryAfterSeconds != null) {
    headers["Retry-After"] = String(decision.retryAfterSeconds);
  }
  if (decision.remaining != null) {
    headers["X-RateLimit-Remaining"] = String(decision.remaining);
  }
  return headers;
}
