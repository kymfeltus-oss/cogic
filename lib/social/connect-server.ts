import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { loadViewerReactions } from "@/lib/social/connect-reactions";
import {
  CONNECT_HISTORY_LIMIT,
  CONNECT_MAX_BODY_LENGTH,
  CONNECT_MAX_MEDIA,
  CONNECT_SLOW_MODE_SECONDS,
  type ConnectFeedPayload,
  type ConnectMediaInput,
  type ConnectMediaItem,
  type ConnectPost,
  type ConnectSession,
} from "@/lib/social/connect-types";

type PostRow = {
  id: string;
  author_id: string;
  body: string;
  like_count: number;
  amen_count: number;
  media_count: number;
  is_pinned: boolean;
  pinned_at: string | null;
  created_at: string;
  deleted_at: string | null;
};

type MediaRow = {
  id: string;
  post_id: string;
  media_type: "image" | "video";
  storage_path: string;
  public_url: string;
  mime_type: string;
  byte_size: number;
  sort_order: number;
};

function mapMedia(row: MediaRow): ConnectMediaItem {
  return {
    id: row.id,
    mediaType: row.media_type,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    sortOrder: row.sort_order,
  };
}

function mapPost(
  row: PostRow,
  profile: { name: string; avatarUrl: string | null } | undefined,
  media: ConnectMediaItem[],
  viewer?: { liked?: boolean; amened?: boolean },
): ConnectPost {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: profile?.name || "Community member",
    authorAvatarUrl: profile?.avatarUrl ?? null,
    body: row.body,
    likeCount: Number(row.like_count || 0),
    amenCount: Number(row.amen_count || 0),
    mediaCount: Number(row.media_count || 0),
    isPinned: row.is_pinned === true,
    pinnedAt: row.pinned_at,
    createdAt: row.created_at,
    media,
    viewerLiked: viewer?.liked === true,
    viewerAmened: viewer?.amened === true,
  };
}

async function hydrateProfiles(admin: SupabaseClient, userIds: string[]) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return new Map<string, { name: string; avatarUrl: string | null }>();

  const { data } = await admin
    .from("attendees")
    .select("id, first_name, last_name, avatar_url")
    .in("id", unique);

  return new Map(
    (data ?? []).map((row) => [
      row.id as string,
      {
        name:
          [row.first_name, row.last_name]
            .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
            .join(" ") || "Community member",
        avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
      },
    ]),
  );
}

export async function loadConnectPostingEnabled(admin: SupabaseClient): Promise<boolean> {
  const { data, error } = await admin
    .from("social_settings")
    .select("posting_enabled")
    .eq("id", "community")
    .maybeSingle();
  if (error) {
    console.warn("Connect posting setting lookup failed:", error.message);
    return true;
  }
  return data?.posting_enabled !== false;
}

export async function loadConnectMuteUntil(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("connect_user_mutes")
    .select("muted_until")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Connect mute lookup failed:", error.message);
    return null;
  }
  if (!data?.muted_until) return null;

  const untilMs = new Date(data.muted_until).getTime();
  if (!Number.isFinite(untilMs) || untilMs <= Date.now()) {
    await admin.from("connect_user_mutes").delete().eq("user_id", userId);
    return null;
  }
  return data.muted_until;
}

export async function buildConnectSession(
  admin: SupabaseClient,
  user: User | null,
  postingEnabled: boolean,
): Promise<ConnectSession> {
  if (!user?.id) {
    return {
      authenticated: false,
      userId: null,
      canSend: false,
      postingEnabled,
      mutedUntil: null,
      slowModeSeconds: CONNECT_SLOW_MODE_SECONDS,
    };
  }
  const mutedUntil = await loadConnectMuteUntil(admin, user.id);
  return {
    authenticated: true,
    userId: user.id,
    canSend: postingEnabled && !mutedUntil,
    postingEnabled,
    mutedUntil,
    slowModeSeconds: CONNECT_SLOW_MODE_SECONDS,
  };
}

export async function assertConnectSlowMode(
  admin: SupabaseClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from("connect_posts")
    .select("created_at")
    .eq("author_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("Connect slow-mode lookup failed:", error.message);
    return { ok: true };
  }
  if (!data?.created_at) return { ok: true };

  const waitMs = CONNECT_SLOW_MODE_SECONDS * 1000 - (Date.now() - new Date(data.created_at).getTime());
  if (waitMs > 0) {
    const waitSeconds = Math.ceil(waitMs / 1000);
    return {
      ok: false,
      error: `Please wait ${waitSeconds} second${waitSeconds === 1 ? "" : "s"} before posting again.`,
    };
  }
  return { ok: true };
}

function validateMediaItems(items: ConnectMediaInput[] | undefined) {
  if (!items?.length) return [] as ConnectMediaInput[];
  if (items.length > CONNECT_MAX_MEDIA) {
    throw new Error(`Maximum of ${CONNECT_MAX_MEDIA} media attachments allowed.`);
  }
  return items.map((item) => {
    const type = item.type === "video" ? "video" : item.type === "image" ? "image" : null;
    const path = String(item.path || "").trim();
    const url = String(item.url || "").trim();
    const mimeType = String(item.mimeType || "").trim();
    const size = Number(item.size);
    if (!type) throw new Error("Each media item must be image or video.");
    if (!path) throw new Error("Media storage path is required.");
    if (!/^https:\/\//i.test(url)) throw new Error("Media URL must be HTTPS.");
    if (!mimeType) throw new Error("Media MIME type is required.");
    if (!Number.isFinite(size) || size <= 0 || size > 52_428_800) {
      throw new Error("Media file size is invalid.");
    }
    return { type, path, url, mimeType, size } satisfies ConnectMediaInput;
  });
}

export async function loadConnectFeed(
  admin: SupabaseClient,
  viewerUserId?: string | null,
): Promise<{
  posts: ConnectPost[];
  pinned: ConnectPost | null;
}> {
  const [pinnedResult, postsResult] = await Promise.all([
    admin
      .from("connect_posts")
      .select(
        "id, author_id, body, like_count, amen_count, media_count, is_pinned, pinned_at, created_at, deleted_at",
      )
      .eq("is_pinned", true)
      .is("deleted_at", null)
      .order("pinned_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("connect_posts")
      .select(
        "id, author_id, body, like_count, amen_count, media_count, is_pinned, pinned_at, created_at, deleted_at",
      )
      .eq("is_pinned", false)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(CONNECT_HISTORY_LIMIT),
  ]);

  if (pinnedResult.error) console.error("Connect pinned load failed:", pinnedResult.error.message);
  if (postsResult.error) console.error("Connect feed load failed:", postsResult.error.message);

  const rows = [
    ...(pinnedResult.data ? [pinnedResult.data as PostRow] : []),
    ...((postsResult.data ?? []) as PostRow[]),
  ];
  const ids = rows.map((row) => row.id);
  const { data: mediaRows } = ids.length
    ? await admin
        .from("connect_post_media")
        .select("id, post_id, media_type, storage_path, public_url, mime_type, byte_size, sort_order")
        .in("post_id", ids)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const mediaByPost = new Map<string, ConnectMediaItem[]>();
  for (const row of (mediaRows ?? []) as MediaRow[]) {
    const list = mediaByPost.get(row.post_id) ?? [];
    list.push(mapMedia(row));
    mediaByPost.set(row.post_id, list);
  }

  const profiles = await hydrateProfiles(
    admin,
    rows.map((row) => row.author_id),
  );
  const viewerReactions = viewerUserId
    ? await loadViewerReactions(admin, viewerUserId, ids)
    : new Map();

  const mapped = rows.map((row) => {
    const reactions = viewerReactions.get(row.id);
    return mapPost(row, profiles.get(row.author_id), mediaByPost.get(row.id) ?? [], {
      liked: reactions?.has("like"),
      amened: reactions?.has("amen"),
    });
  });
  const pinned = mapped.find((post) => post.isPinned) ?? null;
  const posts = mapped.filter((post) => !post.isPinned);
  return { posts, pinned };
}

export async function loadConnectFeedPayload(
  admin: SupabaseClient,
  user: User | null,
): Promise<ConnectFeedPayload> {
  const postingEnabled = await loadConnectPostingEnabled(admin);
  const [feed, session] = await Promise.all([
    loadConnectFeed(admin, user?.id),
    buildConnectSession(admin, user, postingEnabled),
  ]);
  return { posts: feed.posts, pinned: feed.pinned, session };
}

export async function createConnectPost(
  admin: SupabaseClient,
  input: {
    authorId: string;
    body: string;
    mediaItems?: ConnectMediaInput[];
  },
): Promise<ConnectPost> {
  const body = input.body.trim();
  if (body.length < 1 || body.length > CONNECT_MAX_BODY_LENGTH) {
    throw new Error(`Post must be between 1 and ${CONNECT_MAX_BODY_LENGTH} characters.`);
  }
  const mediaItems = validateMediaItems(input.mediaItems);

  const { data: post, error } = await admin
    .from("connect_posts")
    .insert({
      author_id: input.authorId,
      body,
      is_pinned: false,
    })
    .select(
      "id, author_id, body, like_count, amen_count, media_count, is_pinned, pinned_at, created_at, deleted_at",
    )
    .single();

  if (error || !post) {
    throw new Error(error?.message || "Unable to create post.");
  }

  if (mediaItems.length) {
    const { error: mediaError } = await admin.from("connect_post_media").insert(
      mediaItems.map((item, index) => ({
        post_id: post.id,
        media_type: item.type,
        storage_path: item.path,
        public_url: item.url,
        mime_type: item.mimeType,
        byte_size: item.size,
        sort_order: index,
      })),
    );
    if (mediaError) {
      await admin.from("connect_posts").delete().eq("id", post.id);
      throw new Error(mediaError.message || "Unable to attach media.");
    }
  }

  const profiles = await hydrateProfiles(admin, [input.authorId]);
  const { data: mediaRows } = await admin
    .from("connect_post_media")
    .select("id, post_id, media_type, storage_path, public_url, mime_type, byte_size, sort_order")
    .eq("post_id", post.id)
    .order("sort_order", { ascending: true });

  return mapPost(
    post as PostRow,
    profiles.get(input.authorId),
    ((mediaRows ?? []) as MediaRow[]).map(mapMedia),
  );
}
