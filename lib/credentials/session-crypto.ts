import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import type { ResolvedPublicCredential } from "@/lib/credentials/public-outcome";

export const CREDENTIAL_SESSION_MAX_AGE_SECONDS = 15 * 60;
export const CREDENTIAL_SESSION_VERSION = 1;

type CredentialSessionPayload = ResolvedPublicCredential & {
  v: typeof CREDENTIAL_SESSION_VERSION;
  exp: number;
};

function deriveSessionKey(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

function encryptSessionPayload(
  payload: CredentialSessionPayload,
  secret: string,
): string {
  const key = deriveSessionKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decryptSessionPayload(
  value: string,
  secret: string,
): CredentialSessionPayload | null {
  try {
    const raw = Buffer.from(value, "base64url");
    if (raw.length < 29) return null;

    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const key = deriveSessionKey(secret);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
    const parsed = JSON.parse(plaintext) as CredentialSessionPayload;

    if (parsed.v !== CREDENTIAL_SESSION_VERSION) return null;
    if (typeof parsed.exp !== "number") return null;
    if (parsed.status !== "issued" && parsed.status !== "active") return null;

    return parsed;
  } catch {
    return null;
  }
}

export function createCredentialSessionValue(
  resolution: ResolvedPublicCredential,
  secret: string,
  nowMs = Date.now(),
): string {
  const payload: CredentialSessionPayload = {
    v: CREDENTIAL_SESSION_VERSION,
    exp: Math.floor(nowMs / 1000) + CREDENTIAL_SESSION_MAX_AGE_SECONDS,
    ...resolution,
  };

  return encryptSessionPayload(payload, secret);
}

export function readCredentialSessionValue(
  value: string | undefined,
  secret: string,
  nowMs = Date.now(),
): ResolvedPublicCredential | null {
  if (!value || !secret) return null;

  const payload = decryptSessionPayload(value, secret);
  if (!payload) return null;
  if (payload.exp <= Math.floor(nowMs / 1000)) return null;

  return {
    status: payload.status,
    badgeCode: payload.badgeCode,
    firstName: payload.firstName,
    churchName: payload.churchName,
    jurisdiction: payload.jurisdiction,
    programKey: payload.programKey,
  };
}

export function credentialSessionValuesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
