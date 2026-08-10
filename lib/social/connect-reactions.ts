import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ConnectReactionType = "like" | "amen";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isConnectReactionType(value: unknown): value is ConnectReactionType {
  return value === "like" || value === "amen";
}

export async function loadViewerReactions(
  admin: SupabaseClient,
  userId: string,
  postIds: string[],
): Promise<Map<string, Set<ConnectReactionType>>> {
  const map = new Map<string, Set<ConnectReactionType>>();
  if (!postIds.length) return map;

  const { data, error } = await admin
    .from("connect_post_reactions")
    .select("post_id, reaction")
    .eq("user_id", userId)
    .in("post_id", postIds);

  if (error) {
    console.warn("Connect viewer reactions lookup failed:", error.message);
    return map;
  }

  for (const row of data ?? []) {
    const postId = row.post_id as string;
    const reaction = row.reaction as ConnectReactionType;
    const set = map.get(postId) ?? new Set<ConnectReactionType>();
    set.add(reaction);
    map.set(postId, set);
  }
  return map;
}

export async function toggleConnectReaction(
  admin: SupabaseClient,
  input: {
    userId: string;
    postId: string;
    reaction: ConnectReactionType;
  },
): Promise<{
  active: boolean;
  likeCount: number;
  amenCount: number;
}> {
  if (!UUID.test(input.postId)) {
    throw new Error("Valid postId is required.");
  }

  const { data: post, error: postError } = await admin
    .from("connect_posts")
    .select("id")
    .eq("id", input.postId)
    .is("deleted_at", null)
    .maybeSingle();

  if (postError || !post) {
    throw new Error("That post is no longer available.");
  }

  const { data: existing, error: existingError } = await admin
    .from("connect_post_reactions")
    .select("post_id")
    .eq("post_id", input.postId)
    .eq("user_id", input.userId)
    .eq("reaction", input.reaction)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message || "Unable to check reaction.");
  }

  let active = false;
  if (existing) {
    const { error: deleteError } = await admin
      .from("connect_post_reactions")
      .delete()
      .eq("post_id", input.postId)
      .eq("user_id", input.userId)
      .eq("reaction", input.reaction);
    if (deleteError) throw new Error(deleteError.message || "Unable to remove reaction.");
    active = false;
  } else {
    const { error: insertError } = await admin.from("connect_post_reactions").insert({
      post_id: input.postId,
      user_id: input.userId,
      reaction: input.reaction,
    });
    if (insertError) throw new Error(insertError.message || "Unable to add reaction.");
    active = true;
  }

  const { data: counts, error: countError } = await admin
    .from("connect_posts")
    .select("like_count, amen_count")
    .eq("id", input.postId)
    .single();

  if (countError || !counts) {
    throw new Error(countError?.message || "Unable to refresh reaction counts.");
  }

  return {
    active,
    likeCount: Number(counts.like_count || 0),
    amenCount: Number(counts.amen_count || 0),
  };
}
