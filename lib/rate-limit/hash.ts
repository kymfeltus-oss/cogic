import { createHash } from "node:crypto";

/** Hash sensitive identifiers before use in rate-limit keys or logs. */
export function hashRateLimitIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
