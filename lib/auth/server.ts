import type { NextRequest } from "next/server";
import {
  DEFAULT_ATTENDEE_NEXT,
  sanitizeNextPath,
} from "@/lib/auth/routing";

function resolveForwardedOrigin(
  forwardedProto: string | null,
  host: string | null,
): string | null {
  const proto = forwardedProto?.split(",")[0]?.trim();
  const resolvedHost = host?.trim();
  if (proto && resolvedHost) {
    return `${proto}://${resolvedHost}`;
  }
  return null;
}

/** Canonical app origin for auth redirects — prefers NEXT_PUBLIC_APP_URL in production. */
export function getAuthAppUrl(request: NextRequest | Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (envUrl) {
    return envUrl;
  }

  const forwarded = resolveForwardedOrigin(
    request.headers.get("x-forwarded-proto"),
    request.headers.get("host"),
  );
  if (forwarded) {
    return forwarded;
  }

  if ("nextUrl" in request && request.nextUrl instanceof URL) {
    return request.nextUrl.origin;
  }

  return new URL(request.url).origin;
}

/** Supabase emailRedirectTo target — must match Supabase Auth redirect allow list. */
export function buildAuthCallbackUrl(
  nextPath?: string | null,
  request?: NextRequest | Request,
): string {
  const base = request ? getAuthAppUrl(request) : getAuthAppUrlFromEnv();
  const next = sanitizeNextPath(nextPath ?? null, DEFAULT_ATTENDEE_NEXT);
  const url = new URL("/auth/callback", base);
  url.searchParams.set("next", next);
  return url.toString();
}

function getAuthAppUrlFromEnv(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}
