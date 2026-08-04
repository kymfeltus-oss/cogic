/**
 * Origin for browser-originated API fetches.
 * Always uses the active page origin so local dev never cross-fetches production.
 * Server-side Stripe redirects continue to use getAppUrl(request) in checkout/server.
 */
export function getClientAppUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** @deprecated Prefer getClientAppUrl — kept for existing imports */
export function getAppUrl(): string {
  return getClientAppUrl();
}
