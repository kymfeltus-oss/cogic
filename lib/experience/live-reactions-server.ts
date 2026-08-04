import {
  LIVE_REACTION_MIN_INTERVAL_MS,
  LIVE_REACTION_RATE_MAX_PER_WINDOW,
  LIVE_REACTION_RATE_WINDOW_MS,
  LIVE_REACTION_RETENTION_MS,
} from "@/lib/experience/live-reactions";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function assertLiveReactionRateLimit(
  admin: SupabaseClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const windowStart = new Date(Date.now() - LIVE_REACTION_RATE_WINDOW_MS).toISOString();

  const { count, error: countError } = await admin
    .from("live_stream_reactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", windowStart);

  if (countError) {
    console.error("Live reaction rate count failed:", countError.message);
    return { ok: true };
  }

  if ((count ?? 0) >= LIVE_REACTION_RATE_MAX_PER_WINDOW) {
    return {
      ok: false,
      error: "Reactions are moving fast — take a breath and try again.",
    };
  }

  const { data: latest, error: latestError } = await admin
    .from("live_stream_reactions")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError || !latest?.created_at) {
    return { ok: true };
  }

  const elapsedMs = Date.now() - new Date(latest.created_at).getTime();
  if (elapsedMs < LIVE_REACTION_MIN_INTERVAL_MS) {
    return {
      ok: false,
      error: "Give it a moment before sending another reaction.",
    };
  }

  return { ok: true };
}

export async function pruneStaleLiveReactions(admin: SupabaseClient): Promise<void> {
  const cutoff = new Date(Date.now() - LIVE_REACTION_RETENTION_MS).toISOString();
  const { error } = await admin
    .from("live_stream_reactions")
    .delete()
    .lt("created_at", cutoff);

  if (error) {
    console.error("Live reaction prune failed:", error.message);
  }
}
