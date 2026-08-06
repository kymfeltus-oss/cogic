import "server-only";

import { cookies } from "next/headers";

import {
  createCredentialSessionValue as createEncryptedSessionValue,
  CREDENTIAL_SESSION_MAX_AGE_SECONDS,
  readCredentialSessionValue as readEncryptedSessionValue,
} from "@/lib/credentials/session-crypto";
import type { ResolvedPublicCredential } from "@/lib/credentials/public-outcome";

export const CREDENTIAL_SESSION_COOKIE = "cogic_credential_session";
export { CREDENTIAL_SESSION_MAX_AGE_SECONDS } from "@/lib/credentials/session-crypto";

function readSessionSecret(): string | null {
  const secret = process.env.COGIC_CREDENTIAL_SESSION_SECRET?.trim();
  return secret || null;
}

export function isCredentialSessionConfigured(): boolean {
  return readSessionSecret() !== null;
}

export function createCredentialSessionValue(
  resolution: ResolvedPublicCredential,
  nowMs = Date.now(),
): string {
  const secret = readSessionSecret();
  if (!secret) {
    throw new Error("Credential session secret is not configured.");
  }

  return createEncryptedSessionValue(resolution, secret, nowMs);
}

export async function readCredentialSessionFromCookies(): Promise<ResolvedPublicCredential | null> {
  const secret = readSessionSecret();
  if (!secret) return null;

  const cookieStore = await cookies();
  const value = cookieStore.get(CREDENTIAL_SESSION_COOKIE)?.value;
  return readEncryptedSessionValue(value, secret);
}

export function credentialSessionCookieOptions(nowMs = Date.now()): {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/c";
  maxAge: number;
  expires: Date;
} {
  return {
    name: CREDENTIAL_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/c",
    maxAge: CREDENTIAL_SESSION_MAX_AGE_SECONDS,
    expires: new Date(nowMs + CREDENTIAL_SESSION_MAX_AGE_SECONDS * 1000),
  };
}
