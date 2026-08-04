import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

let browserClient: SupabaseClient | null = null;

export function createBrowserSupabaseClient(): SupabaseClient {
  if (browserClient) return browserClient;

  browserClient = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());

  void browserClient.auth.getSession().catch(async (sessionError: unknown) => {
    const message =
      sessionError instanceof Error ? sessionError.message : String(sessionError);

    if (/fetch failed|Failed to fetch|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(message)) {
      await browserClient?.auth.signOut({ scope: "local" });
    }
  });

  return browserClient;
}
