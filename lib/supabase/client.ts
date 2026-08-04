import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

/** Browser Supabase client — session cookies managed by @supabase/ssr */
export function getSupabase(): SupabaseClient {
  return createBrowserSupabaseClient();
}
