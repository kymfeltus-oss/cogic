"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { getClientAppUrl } from "@/lib/client-api";
import {
  buildChannelName,
  createRealtimeChannel,
  teardownRealtimeChannel,
} from "@/lib/live/realtime-subscribe";
import {
  CONNECT_MAX_BODY_LENGTH,
  type ConnectFeedPayload,
  type ConnectMediaInput,
  type ConnectPost,
  type ConnectSession,
} from "@/lib/social/connect-types";
import { getSupabase } from "@/lib/supabase/client";

const CONNECT_CHANNEL = "cogic-connect-feed";
const POLL_FALLBACK_MS = 15_000;

const DEFAULT_SESSION: ConnectSession = {
  authenticated: false,
  userId: null,
  canSend: false,
  postingEnabled: true,
  mutedUntil: null,
  slowModeSeconds: 7,
};

type UseConnectFeedResult = {
  posts: ConnectPost[];
  pinned: ConnectPost | null;
  session: ConnectSession;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  sendPost: (body: string, mediaItems?: ConnectMediaInput[]) => Promise<boolean>;
  reactToPost: (
    postId: string,
    reactionType: "like" | "amen",
  ) => Promise<boolean>;
  clearError: () => void;
  refresh: () => Promise<void>;
};

function mergePosts(current: ConnectPost[], incoming: ConnectPost): ConnectPost[] {
  if (current.some((post) => post.id === incoming.id)) return current;
  return [incoming, ...current].slice(0, 100);
}

export function useConnectFeed(): UseConnectFeedResult {
  const instanceId = useId().replace(/:/g, "");
  const channelRef = useRef<Awaited<ReturnType<typeof createRealtimeChannel>> | null>(null);
  const syncAbortRef = useRef<AbortController | null>(null);

  const [posts, setPosts] = useState<ConnectPost[]>([]);
  const [pinned, setPinned] = useState<ConnectPost | null>(null);
  const [session, setSession] = useState<ConnectSession>(DEFAULT_SESSION);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usePollingFallback, setUsePollingFallback] = useState(false);

  const syncFeed = useCallback(async () => {
    syncAbortRef.current?.abort();
    const abortController = new AbortController();
    syncAbortRef.current = abortController;

    try {
      const response = await fetch(`${getClientAppUrl()}/api/social/posts`, {
        cache: "no-store",
        credentials: "include",
        signal: abortController.signal,
      });

      if (abortController.signal.aborted) return;

      if (response.status === 401) {
        setPosts([]);
        setPinned(null);
        setSession(DEFAULT_SESSION);
        setError("Sign in to view COGIC Connect.");
        return;
      }

      if (!response.ok) {
        throw new Error(`feed unavailable (${response.status})`);
      }

      const payload = (await response.json()) as ConnectFeedPayload;
      if (abortController.signal.aborted) return;

      setPosts(payload.posts ?? []);
      setPinned(payload.pinned ?? null);
      setSession(payload.session ?? DEFAULT_SESSION);
      setUsePollingFallback(false);
      setError(null);
    } catch (syncError) {
      if (
        abortController.signal.aborted ||
        (syncError instanceof DOMException && syncError.name === "AbortError") ||
        (syncError instanceof Error && syncError.name === "AbortError")
      ) {
        return;
      }
      console.error("Connect feed sync failed:", syncError);
      setUsePollingFallback(true);
      setError("COGIC Connect is temporarily unavailable.");
    } finally {
      if (!abortController.signal.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      syncAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    queueMicrotask(() => void syncFeed());
  }, [syncFeed]);

  useEffect(() => {
    if (!usePollingFallback) return;
    const intervalId = window.setInterval(() => {
      void syncFeed();
    }, POLL_FALLBACK_MS);
    return () => window.clearInterval(intervalId);
  }, [syncFeed, usePollingFallback]);

  useEffect(() => {
    let cancelled = false;
    let supabase: ReturnType<typeof getSupabase>;
    let setupPromise: Promise<void> = Promise.resolve();

    try {
      supabase = getSupabase();
    } catch (initError) {
      console.error("Connect realtime init failed:", initError);
      queueMicrotask(() => setUsePollingFallback(true));
      return;
    }

    const channelName = buildChannelName(CONNECT_CHANNEL, instanceId);

    setupPromise = (async () => {
      try {
        const channel = await createRealtimeChannel(supabase, channelName, {
          postgres: [
            {
              event: "INSERT",
              schema: "public",
              table: "connect_posts",
              callback: () => {
                void syncFeed();
              },
            },
            {
              event: "UPDATE",
              schema: "public",
              table: "connect_posts",
              callback: () => {
                void syncFeed();
              },
            },
          ],
        });

        if (cancelled) {
          await teardownRealtimeChannel(supabase, channel);
          return;
        }

        channelRef.current = channel;
      } catch (subscribeError) {
        console.error("Connect subscribe failed:", subscribeError);
        if (!cancelled) setUsePollingFallback(true);
      }
    })();

    return () => {
      cancelled = true;
      void (async () => {
        await setupPromise;
        const channel = channelRef.current;
        channelRef.current = null;
        await teardownRealtimeChannel(supabase, channel);
      })();
    };
  }, [instanceId, syncFeed]);

  const sendPost = useCallback(
    async (rawBody: string, mediaItems: ConnectMediaInput[] = []): Promise<boolean> => {
      const body = rawBody.trim();
      if (!body && !mediaItems.length) return false;

      if (!session.authenticated) {
        setError("Sign in to post in COGIC Connect.");
        return false;
      }
      if (!session.canSend) {
        setError("Posting is currently unavailable for your account.");
        return false;
      }
      if (!body || body.length > CONNECT_MAX_BODY_LENGTH) {
        setError(`Posts must be between 1 and ${CONNECT_MAX_BODY_LENGTH} characters.`);
        return false;
      }

      setIsSending(true);
      setError(null);

      try {
        const response = await fetch(`${getClientAppUrl()}/api/social/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ body, mediaItems }),
        });
        const data = (await response.json()) as { post?: ConnectPost; error?: string };

        if (response.status === 401) {
          setError("Sign in to post in COGIC Connect.");
          return false;
        }
        if (!response.ok || !data.post) {
          setError(data.error ?? "Unable to create post.");
          return false;
        }

        if (data.post.isPinned) {
          setPinned(data.post);
        } else {
          setPosts((current) => mergePosts(current, data.post as ConnectPost));
        }
        return true;
      } catch (sendError) {
        console.error("Connect post failed:", sendError);
        setError("Unable to create post. Please try again.");
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [session.authenticated, session.canSend],
  );

  const reactToPost = useCallback(
    async (postId: string, reactionType: "like" | "amen"): Promise<boolean> => {
      if (!session.authenticated) {
        setError("Sign in to react in COGIC Connect.");
        return false;
      }

      try {
        const response = await fetch(`${getClientAppUrl()}/api/social/posts/react`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ postId, reactionType }),
        });
        const data = (await response.json()) as {
          active?: boolean;
          likeCount?: number;
          amenCount?: number;
          error?: string;
        };

        if (!response.ok) {
          setError(data.error ?? "Unable to update reaction.");
          return false;
        }

        const patch = (post: ConnectPost): ConnectPost => {
          if (post.id !== postId) return post;
          return {
            ...post,
            likeCount: Number(data.likeCount ?? post.likeCount),
            amenCount: Number(data.amenCount ?? post.amenCount),
            viewerLiked:
              reactionType === "like" ? data.active === true : post.viewerLiked,
            viewerAmened:
              reactionType === "amen" ? data.active === true : post.viewerAmened,
          };
        };

        setPosts((current) => current.map(patch));
        setPinned((current) => (current ? patch(current) : current));
        return true;
      } catch (reactError) {
        console.error("Connect reaction failed:", reactError);
        setError("Unable to update reaction.");
        return false;
      }
    },
    [session.authenticated],
  );

  return {
    posts,
    pinned,
    session,
    isLoading,
    isSending,
    error,
    sendPost,
    reactToPost,
    clearError: () => setError(null),
    refresh: syncFeed,
  };
}
