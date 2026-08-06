export class PublicOriginConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicOriginConfigurationError";
  }
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost")
  );
}

function readOriginCandidate(raw: string | undefined): URL | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * Canonical public web origin for QR / credential deep links.
 * Precedence: COGIC_STREAM_PUBLIC_WEB_ORIGIN → NEXT_PUBLIC_APP_URL
 * Fail closed when production origin is missing/invalid. No legacy domain fallback.
 */
export function resolvePublicWebOrigin(): URL {
  const candidates = [
    process.env.COGIC_STREAM_PUBLIC_WEB_ORIGIN,
    process.env.NEXT_PUBLIC_APP_URL,
  ];

  let lastError: string | null = null;

  for (const candidate of candidates) {
    const url = readOriginCandidate(candidate);
    if (!url) {
      if (candidate?.trim()) {
        lastError = "Public web origin is not a valid URL.";
      }
      continue;
    }

    const local = isLocalHostname(url.hostname);
    const production = process.env.NODE_ENV === "production";

    if (production && local) {
      lastError = "Production public origin cannot be localhost.";
      continue;
    }

    if (production && url.protocol !== "https:") {
      lastError = "Production public origin must use HTTPS.";
      continue;
    }

    if (!local && url.protocol !== "https:") {
      lastError = "Public origin must use HTTPS outside local development.";
      continue;
    }

    if (local && url.protocol !== "http:" && url.protocol !== "https:") {
      lastError = "Local public origin must use http or https.";
      continue;
    }

    return url;
  }

  throw new PublicOriginConfigurationError(
    lastError ??
      "Public web origin is not configured. Set COGIC_STREAM_PUBLIC_WEB_ORIGIN or NEXT_PUBLIC_APP_URL.",
  );
}

export function canonicalCredentialHost(): string {
  return resolvePublicWebOrigin().host;
}

export function buildCanonicalCredentialUrl(rawToken: string): string {
  const host = canonicalCredentialHost();
  return `https://${host}/c/${rawToken}`;
}
