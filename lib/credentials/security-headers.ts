import type { NextResponse } from "next/server";

export const CREDENTIAL_CACHE_CONTROL =
  "private, no-store, max-age=0, must-revalidate";

export const CREDENTIAL_REFERRER_POLICY = "no-referrer";

export const CREDENTIAL_ROBOTS_TAG = "noindex, nofollow, noarchive";

export const CREDENTIAL_SECURITY_HEADER_ENTRIES = [
  { key: "Cache-Control", value: CREDENTIAL_CACHE_CONTROL },
  { key: "Referrer-Policy", value: CREDENTIAL_REFERRER_POLICY },
  { key: "X-Robots-Tag", value: CREDENTIAL_ROBOTS_TAG },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
] as const;

export function applyCredentialSecurityHeaders(response: NextResponse): NextResponse {
  for (const header of CREDENTIAL_SECURITY_HEADER_ENTRIES) {
    response.headers.set(header.key, header.value);
  }
  return response;
}

export function credentialSecurityHeaderRecord(): Record<string, string> {
  const record: Record<string, string> = {};
  for (const header of CREDENTIAL_SECURITY_HEADER_ENTRIES) {
    record[header.key] = header.value;
  }
  return record;
}
