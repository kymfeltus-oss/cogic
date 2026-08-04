import "server-only";
import crypto from "crypto";

const DEFAULT_STREAM_KEY_PREFIX = "300awakening_live";

/** Server-only: cryptographically secure operator stream key. */
export function generateSecureStreamKey(
  prefix: string = DEFAULT_STREAM_KEY_PREFIX,
): string {
  const randomHex = crypto.randomBytes(5).toString("hex");
  return `${prefix}_${randomHex}`;
}
