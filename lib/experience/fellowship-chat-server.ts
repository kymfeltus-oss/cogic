import {
  FELLOWSHIP_CHAT_HISTORY_LIMIT,
  FELLOWSHIP_SLOW_MODE_SECONDS,
  mapFellowshipChatRow,
  type FellowshipChatMessage,
  type FellowshipChatMessageRow,
  type FellowshipChatSession,
} from "@/lib/experience/fellowship-chat";
import {
  FELLOWSHIP_MESSAGE_SELECT_FULL,
  FELLOWSHIP_MESSAGE_SELECT_LEGACY,
  isFellowshipSchemaMismatchError,
} from "@/lib/experience/fellowship-chat-db";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function loadActiveMuteUntil(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("chat_room_mutes")
    .select("muted_until")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isFellowshipSchemaMismatchError(error)) {
      return null;
    }
    console.warn("Fellowship mute lookup failed:", error.message);
    return null;
  }

  if (!data?.muted_until) return null;

  const mutedUntilMs = new Date(data.muted_until).getTime();
  if (Number.isNaN(mutedUntilMs) || mutedUntilMs <= Date.now()) {
    await admin.from("chat_room_mutes").delete().eq("user_id", userId);
    return null;
  }

  return data.muted_until;
}

export async function buildFellowshipSession(
  admin: SupabaseClient,
  user: User | null,
  postingEnabled = true,
): Promise<FellowshipChatSession> {
  if (!user) {
    return {
      authenticated: false,
      userId: null,
      canSend: false,
      isModerator: false,
      postingEnabled,
      mutedUntil: null,
      slowModeSeconds: FELLOWSHIP_SLOW_MODE_SECONDS,
    };
  }

  const mutedUntil = await loadActiveMuteUntil(admin, user.id);

  return {
    authenticated: true,
    userId: user.id,
    canSend: postingEnabled && !mutedUntil,
    isModerator: false,
    postingEnabled,
    mutedUntil,
    slowModeSeconds: FELLOWSHIP_SLOW_MODE_SECONDS,
  };
}

export async function loadSocialPostingEnabled(admin: SupabaseClient): Promise<boolean> {
  const { data, error } = await admin
    .from("social_settings")
    .select("posting_enabled")
    .eq("id", "community")
    .maybeSingle();

  if (error) {
    if (isFellowshipSchemaMismatchError(error)) return true;
    console.warn("COGIC Social setting lookup failed:", error.message);
    return true;
  }

  return data?.posting_enabled !== false;
}

async function hydrateFellowshipAuthors(
  admin: SupabaseClient,
  messages: FellowshipChatMessage[],
): Promise<FellowshipChatMessage[]> {
  const userIds = [...new Set(messages.map((message) => message.userId).filter(Boolean))];
  if (userIds.length === 0) return messages;

  const { data, error } = await admin
    .from("attendees")
    .select("id, first_name, last_name, avatar_url")
    .in("id", userIds);
  if (error) return messages;

  const profiles = new Map(
    (data ?? []).map((row) => [
      row.id as string,
      {
        name: [row.first_name, row.last_name]
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          .join(" "),
        avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
      },
    ]),
  );

  return messages.map((message) => {
    const profile = profiles.get(message.userId);
    if (!profile) return message;
    return {
      ...message,
      author: profile.name || message.author,
      authorAvatarUrl: profile.avatarUrl,
    };
  });
}

async function loadFellowshipChatFeedLegacy(admin: SupabaseClient): Promise<{
  messages: FellowshipChatMessage[];
  pinned: FellowshipChatMessage | null;
}> {
  const { data: messageRows, error } = await admin
    .from("chat_messages")
    .select(FELLOWSHIP_MESSAGE_SELECT_LEGACY)
    .order("created_at", { ascending: false })
    .limit(FELLOWSHIP_CHAT_HISTORY_LIMIT);

  if (error) {
    console.error("Fellowship chat legacy feed load failed:", error.message);
    return { messages: [], pinned: null };
  }

  const messages = [...(messageRows ?? [])]
    .reverse()
    .map((row) => mapFellowshipChatRow(row as FellowshipChatMessageRow));

  return { messages: await hydrateFellowshipAuthors(admin, messages), pinned: null };
}

export async function loadFellowshipChatFeed(admin: SupabaseClient): Promise<{
  messages: FellowshipChatMessage[];
  pinned: FellowshipChatMessage | null;
}> {
  const [pinnedResult, messagesResult] = await Promise.all([
    admin
      .from("chat_messages")
      .select(FELLOWSHIP_MESSAGE_SELECT_FULL)
      .eq("is_pinned", true)
      .is("deleted_at", null)
      .order("pinned_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("chat_messages")
      .select(FELLOWSHIP_MESSAGE_SELECT_FULL)
      .is("deleted_at", null)
      .eq("is_pinned", false)
      .order("created_at", { ascending: false })
      .limit(FELLOWSHIP_CHAT_HISTORY_LIMIT),
  ]);

  const schemaMismatch =
    isFellowshipSchemaMismatchError(pinnedResult.error) ||
    isFellowshipSchemaMismatchError(messagesResult.error);

  if (schemaMismatch) {
    console.warn(
      "[fellowship-chat] Moderation columns missing — using legacy chat_messages schema.",
    );
    return loadFellowshipChatFeedLegacy(admin);
  }

  if (pinnedResult.error) {
    console.error("Fellowship chat pinned load failed:", pinnedResult.error.message);
  }
  if (messagesResult.error) {
    console.error("Fellowship chat feed load failed:", messagesResult.error.message);
  }

  const messages = [...(messagesResult.data ?? [])]
    .reverse()
    .map((row) => mapFellowshipChatRow(row as FellowshipChatMessageRow));

  const pinned = pinnedResult.data
    ? mapFellowshipChatRow(pinnedResult.data as FellowshipChatMessageRow)
    : null;

  const hydrated = await hydrateFellowshipAuthors(
    admin,
    pinned ? [...messages, pinned] : messages,
  );
  return {
    messages: pinned ? hydrated.slice(0, -1) : hydrated,
    pinned: pinned ? hydrated.at(-1) ?? pinned : null,
  };
}

export async function assertFellowshipSlowMode(
  admin: SupabaseClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let result = await admin
    .from("chat_messages")
    .select("created_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error && isFellowshipSchemaMismatchError(result.error)) {
    result = await admin
      .from("chat_messages")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  }

  if (result.error) {
    console.warn("Fellowship slow-mode lookup failed:", result.error.message);
    return { ok: true };
  }

  if (!result.data?.created_at) return { ok: true };

  const elapsedMs = Date.now() - new Date(result.data.created_at).getTime();
  const waitMs = FELLOWSHIP_SLOW_MODE_SECONDS * 1_000 - elapsedMs;

  if (waitMs > 0) {
    const waitSeconds = Math.ceil(waitMs / 1_000);
    return {
      ok: false,
      error: `Please wait ${waitSeconds} second${waitSeconds === 1 ? "" : "s"} before sending again.`,
    };
  }

  return { ok: true };
}

export async function insertFellowshipChatMessage(
  admin: SupabaseClient,
  payload: { user_id: string; email: string; content: string },
): Promise<{ data: FellowshipChatMessageRow | null; error: string | null; usedLegacy: boolean }> {
  let insertResult = await admin
    .from("chat_messages")
    .insert({
      user_id: payload.user_id,
      email: payload.email,
      content: payload.content,
      is_pinned: false,
    })
    .select(FELLOWSHIP_MESSAGE_SELECT_FULL)
    .single();

  if (
    insertResult.error &&
    isFellowshipSchemaMismatchError(insertResult.error)
  ) {
    insertResult = await admin
      .from("chat_messages")
      .insert({
        user_id: payload.user_id,
        email: payload.email,
        content: payload.content,
      })
      .select(FELLOWSHIP_MESSAGE_SELECT_LEGACY)
      .single();

    if (!insertResult.error && insertResult.data) {
      return {
        data: insertResult.data as FellowshipChatMessageRow,
        error: null,
        usedLegacy: true,
      };
    }
  }

  return {
    data: (insertResult.data as FellowshipChatMessageRow | null) ?? null,
    error: insertResult.error?.message ?? null,
    usedLegacy: false,
  };
}
