import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export async function POST(request: NextRequest) {
  let response = NextResponse.json({ success: true });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.json({ success: true });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.signOut({ scope: "global" });

  if (error) {
    console.error("Supabase signOut failed:", error.message);
    return NextResponse.json(
      { success: false, error: "Unable to sign out." },
      { status: 500 },
    );
  }

  return response;
}
