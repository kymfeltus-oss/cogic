import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export type AuthenticatedBuyer = {
  userId: string;
  email: string;
};

type CookieMutation = {
  name: string;
  value: string;
  options?: CookieOptions;
};

type RequestBoundSupabase = {
  client: SupabaseClient;
  withSessionCookies: (response: NextResponse) => NextResponse;
};

/** Bind Supabase SSR client to the active request cookie jar (never trust body email). */
export function createRequestBoundSupabase(
  request: NextRequest,
): RequestBoundSupabase {
  const pendingCookies: CookieMutation[] = [];

  const client = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach((cookie) => {
          request.cookies.set(cookie.name, cookie.value);
          const index = pendingCookies.findIndex((entry) => entry.name === cookie.name);
          if (index >= 0) {
            pendingCookies[index] = cookie;
          } else {
            pendingCookies.push(cookie);
          }
        });
      },
    },
  });

  return {
    client,
    withSessionCookies(response: NextResponse) {
      pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
      return response;
    },
  };
}

export function getAppUrl(request: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    request.headers.get("origin") ??
    "http://localhost:3000"
  );
}

export function getStripeSecretKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes("yourActual")) {
    return null;
  }
  return key;
}

/**
 * Resolve buyer identity from cryptographically verified Supabase session cookies.
 * NEVER read email or user_id from the JSON request body.
 */
export async function resolveAuthenticatedBuyer(
  request: NextRequest,
): Promise<{ buyer: AuthenticatedBuyer; withSessionCookies: RequestBoundSupabase["withSessionCookies"] } | null> {
  const { client, withSessionCookies } = createRequestBoundSupabase(request);
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user?.id || !user.email) {
    return null;
  }

  return {
    buyer: {
      userId: user.id,
      email: user.email.trim().toLowerCase(),
    },
    withSessionCookies,
  };
}

/** Map Stripe SDK failures to attendee-safe checkout messages. */
export function formatStripeCheckoutError(error: unknown): string {
  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    if (
      error.param === "line_items" ||
      /no such price/i.test(error.message)
    ) {
      return "Seed checkout prices are misconfigured. Remove placeholder STRIPE_PRICE_SEEDS_* values from your environment, or add real Stripe Price IDs.";
    }

    if (/invalid email/i.test(error.message)) {
      return "Your account email could not be used for checkout. Update your email in account settings and try again.";
    }

    return error.message;
  }

  if (error instanceof Stripe.errors.StripeError) {
    return error.message;
  }

  return "Unable to start checkout. Please try again.";
}
