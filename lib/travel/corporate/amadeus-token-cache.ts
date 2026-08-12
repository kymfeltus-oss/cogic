import "server-only";

import type { AmadeusCorporateCredentials } from "@/lib/travel/corporate/supplier-mapping";

type TokenCacheEntry = {
  token: string;
  expiresAt: number;
  cacheKey: string;
};

let tokenCache: TokenCacheEntry | null = null;

function cacheKey(credentials: AmadeusCorporateCredentials): string {
  return `${credentials.baseUrl}::${credentials.clientId}`;
}

/**
 * OAuth2 client_credentials token for Amadeus corporate group searches.
 * Cached in-process until 30s before expiry.
 */
export async function fetchAmadeusAccessToken(
  credentials: AmadeusCorporateCredentials,
): Promise<string> {
  const key = cacheKey(credentials);
  if (tokenCache && tokenCache.cacheKey === key && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.token;
  }

  const response = await fetch(`${credentials.baseUrl}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    }),
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  } | null;

  if (!response.ok || !body?.access_token) {
    throw new Error(body?.error_description || "Amadeus authentication failed.");
  }

  tokenCache = {
    cacheKey: key,
    token: String(body.access_token),
    expiresAt: Date.now() + Number(body.expires_in || 1799) * 1000,
  };

  return tokenCache.token;
}

/** Test helper — clears in-process token cache. */
export function resetAmadeusTokenCacheForTests(): void {
  tokenCache = null;
}
