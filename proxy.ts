import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isAttendeeAuthOpen } from "@/lib/auth/attendee-auth-open";
import {
  ATTENDEE_GATE_PATH,
  AUTH_NEXT_COOKIE,
  buildTeamGateUrl,
  isAttendeeProtectedPath,
  isTeamProtectedPath,
} from "@/lib/auth/routing";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { applyCredentialSecurityHeaders } from "@/lib/credentials/security-headers";
import { isCredentialPublicRoute } from "@/lib/routes";

/** Fail fast when Supabase is slow/unreachable — avoids 10s hangs on client navigation. */
const PROXY_AUTH_LOOKUP_TIMEOUT_MS = 2_500;

function isAuthTransportError(message: string): boolean {
  return /ENOTFOUND|fetch failed|Failed to fetch|ECONNREFUSED|ETIMEDOUT|timeout|UND_ERR_CONNECT_TIMEOUT/i.test(
    message,
  );
}

function authErrorMessage(error: unknown): string {
  if (
    error instanceof Error &&
    "cause" in error &&
    error.cause instanceof Error
  ) {
    return error.cause.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "unknown";
}

async function getProxyAuthUser(
  supabase: ReturnType<typeof createServerClient>,
): Promise<{ user: User | null; transportFailed: boolean }> {
  try {
    const { data } = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("proxy auth lookup timeout")),
          PROXY_AUTH_LOOKUP_TIMEOUT_MS,
        );
      }),
    ]);
    return { user: data.user, transportFailed: false };
  } catch (authError) {
    return {
      user: null,
      transportFailed: isAuthTransportError(authErrorMessage(authError)),
    };
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isCredentialPublicRoute(pathname)) {
    return applyCredentialSecurityHeaders(NextResponse.next());
  }

  if (/^\/countdown/i.test(pathname)) {
    const normalized = pathname.replace(/^\/countdown/i, "/countdown");
    if (normalized !== pathname) {
      const url = request.nextUrl.clone();
      url.pathname = normalized;
      return NextResponse.redirect(url, 308);
    }
  }

  if (
    pathname.startsWith("/email-gate") ||
    pathname === ATTENDEE_GATE_PATH ||
    pathname === "/create-account" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  const isAttendeeRoute = isAttendeeProtectedPath(pathname);
  const isTeamRoute = isTeamProtectedPath(pathname);

  // Temporary: let anonymous visitors browse attendee surfaces (dashboard, etc.).
  if (isAttendeeRoute && !isTeamRoute && isAttendeeAuthOpen()) {
    return NextResponse.next();
  }

  if (!isAttendeeRoute && !isTeamRoute) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });

        const incomingNames = new Set(cookiesToSet.map((cookie) => cookie.name));
        request.cookies.getAll().forEach(({ name }) => {
          if (/^sb-.*-auth-token(\.\d+)?$/.test(name) && !incomingNames.has(name)) {
            response.cookies.delete(name);
          }
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  let user = null;
  let authTransportFailed = false;
  const authResult = await getProxyAuthUser(supabase);
  user = authResult.user;
  authTransportFailed = authResult.transportFailed;

  if (authTransportFailed) {
    request.cookies.getAll().forEach(({ name }) => {
      if (/^sb-.*-auth-token(\.\d+)?$/.test(name)) {
        response.cookies.delete(name);
      }
    });
  }

  if (user) return response;

  const nextPath = `${pathname}${request.nextUrl.search}`;

  if (isTeamRoute) {
    const redirectUrl = new URL(buildTeamGateUrl(nextPath), request.url);
    return NextResponse.redirect(redirectUrl);
  }

  const redirectUrl = new URL(ATTENDEE_GATE_PATH, request.url);
  const redirectResponse = NextResponse.redirect(redirectUrl);
  redirectResponse.cookies.set(AUTH_NEXT_COOKIE, nextPath, {
    path: "/",
    maxAge: 60 * 10,
    sameSite: "lax",
  });
  return redirectResponse;
}

export const config = {
  matcher: [
    "/c",
    "/c/:path*",
    "/countdown",
    "/countdown/:path*",
    "/COUNTDOWN",
    "/COUNTDOWN/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/attendee-dashboard",
    "/my-convocation",
    "/my-convocation/:path*",
    "/admin/:path*",
    "/my-sanctuary",
    "/experience",
    "/experience/:path*",
    "/owner",
    "/owner/:path*",
  ],
};
