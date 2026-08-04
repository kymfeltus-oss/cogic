/**
 * Opaque credential token crypto — server boundary only.
 * Do not import from Client Components. Enforced by boundary-contract tests.
 * Raw tokens must never be logged or persisted.
 */
import { createHash, randomBytes } from "node:crypto";

/** Opaque credential token: 32 random bytes → base64url (43 chars). */
export const CREDENTIAL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const CREDENTIAL_TOKEN_BYTE_LENGTH = 32;
export const CREDENTIAL_TOKEN_CHAR_LENGTH = 43;
export const CREDENTIAL_HASH_BYTE_LENGTH = 32;
export const CREDENTIAL_TOKEN_MAX_INPUT_LENGTH = 64;

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateCredentialToken(): string {
  const token = randomBytes(CREDENTIAL_TOKEN_BYTE_LENGTH).toString("base64url");
  if (!isValidCredentialToken(token)) {
    throw new Error("Generated credential token failed validation.");
  }
  return token;
}

export function isValidCredentialToken(token: unknown): token is string {
  if (typeof token !== "string") return false;
  if (token.length !== CREDENTIAL_TOKEN_CHAR_LENGTH) return false;
  if (token.length > CREDENTIAL_TOKEN_MAX_INPUT_LENGTH) return false;
  return CREDENTIAL_TOKEN_PATTERN.test(token);
}

/**
 * SHA-256 digest of the exact UTF-8 token bytes.
 * Returns a 32-byte Buffer — never log or persist the plaintext token.
 */
export function hashCredentialToken(token: string): Buffer {
  if (!isValidCredentialToken(token)) {
    throw new Error("Invalid credential token format.");
  }
  return createHash("sha256").update(token, "utf8").digest();
}

export function credentialTokenHashHex(token: string): string {
  return hashCredentialToken(token).toString("hex");
}

/**
 * Non-secret badge code for authorized support lookup.
 * Format: CS26-{8 Crockford Base32 chars}
 */
export function generateBadgeCode(): string {
  const bytes = randomBytes(8);
  let body = "";
  for (let i = 0; i < 8; i += 1) {
    body += CROCKFORD[bytes[i]! % CROCKFORD.length]!;
  }
  return `CS26-${body}`;
}
