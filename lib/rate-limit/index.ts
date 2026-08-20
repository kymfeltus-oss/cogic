import "server-only";

import { createHash } from "node:crypto";
import { hashRateLimitIdentifier } from "@/lib/rate-limit/hash";
import { isDistributedRateLimitConfigured } from "@/lib/rate-limit/config";
import { RedisRateLimitStore } from "@/lib/rate-limit/redis-store";
import type { RateLimitDecision } from "@/lib/rate-limit/types";

const store = new RedisRateLimitStore();

/** Credential ingress: tighter window against token probing. */
const CREDENTIAL_INGRESS_LIMIT = 40;
const CREDENTIAL_INGRESS_WINDOW_SECONDS = 60;

/** Checkout creation: protect repeated attempts per authenticated identity. */
const CHECKOUT_LIMIT = 8;
const CHECKOUT_WINDOW_SECONDS = 600;
const STAFF_SCAN_LIMIT = 240;
const STAFF_SCAN_WINDOW_SECONDS = 60;
const OTP_REQUEST_LIMIT = 5;
const OTP_REQUEST_WINDOW_SECONDS = 15 * 60;
const OTP_VERIFY_LIMIT = 8;
const OTP_VERIFY_WINDOW_SECONDS = 15 * 60;

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

export async function enforceGivingCheckoutRateLimit(
  request: Request,
  userId: string,
): Promise<RateLimitDecision> {
  const ipHash = hashRateLimitIdentifier(clientIpFromRequest(request));
  const userHash = hashRateLimitIdentifier(userId);
  return store.hit({
    key: bucketKey(["giving-checkout", userHash, ipHash]),
    limit: CHECKOUT_LIMIT,
    windowSeconds: CHECKOUT_WINDOW_SECONDS,
  });
}

/** High-throughput authenticated door limit; keyed by staff identity and IP. */
export async function enforceStaffScanRateLimit(request: Request, userId: string): Promise<RateLimitDecision> {
  const ipHash = hashRateLimitIdentifier(clientIpFromRequest(request));
  const userHash = hashRateLimitIdentifier(userId);
  return store.hit({ key: bucketKey(["staff-scan", userHash, ipHash]), limit: STAFF_SCAN_LIMIT, windowSeconds: STAFF_SCAN_WINDOW_SECONDS });
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

export async function enforceOtpRateLimit(request: Request, identifier: string, phase: "request" | "verify"): Promise<RateLimitDecision> {
  const ipHash = hashRateLimitIdentifier(clientIpFromRequest(request));
  const subjectHash = hashRateLimitIdentifier(identifier);
  return store.hit({
    key: bucketKey(["account-otp", phase, subjectHash, ipHash]),
    limit: phase === "request" ? OTP_REQUEST_LIMIT : OTP_VERIFY_LIMIT,
    windowSeconds: phase === "request" ? OTP_REQUEST_WINDOW_SECONDS : OTP_VERIFY_WINDOW_SECONDS,
  });
}
