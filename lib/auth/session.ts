import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/ssr-server";

/** Server-side session read from verified Supabase auth cookies (never localStorage). */
export async function getUserFromSession(): Promise<User | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}
