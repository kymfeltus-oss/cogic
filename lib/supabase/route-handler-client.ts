import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

type RouteHandlerSupabase = {
  supabase: SupabaseClient;
  getResponse: () => NextResponse;
};

/** Supabase client that persists auth cookies on the route handler response. */
export function createRouteHandlerSupabaseClient(
  request: NextRequest,
  makeResponse: () => NextResponse,
): RouteHandlerSupabase {
  let response = makeResponse();

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = makeResponse();
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  return {
    supabase,
    getResponse: () => response,
  };
}
