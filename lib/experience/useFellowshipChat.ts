"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  FELLOWSHIP_MAX_CONTENT_LENGTH,
  mapFellowshipChatRow,
  mergeFellowshipMessages,
  type FellowshipChatMessage,
  type FellowshipChatMessageRow,
  type FellowshipChatPayload,
  type FellowshipChatSession,
} from "@/lib/experience/fellowship-chat";
import {
  buildChannelName,
  createRealtimeChannel,
  teardownRealtimeChannel,
} from "@/lib/live/realtime-subscribe";
import { getClientAppUrl } from "@/lib/client-api";
import { useParableSubsystem } from "@/lib/parable/useParableSubsystem";
import { getSupabase } from "@/lib/supabase/client";

const FELLOWSHIP_CHAT_CHANNEL = "fellowship-chat";
const POLL_FALLBACK_MS = 15_000;

type UseFellowshipChatResult = {
  messages: FellowshipChatMessage[];
  pinned: FellowshipChatMessage | null;
  session: FellowshipChatSession;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<boolean>;
  moderate: (
    body: Record<string, unknown>,
  ) => Promise<{ ok: boolean; error?: string }>;
  clearError: () => void;
  refresh: () => Promise<void>;
};

const DEFAULT_SESSION: FellowshipChatSession = {
  authenticated: false,
  canSend: false,
  isModerator: false,
  mutedUntil: null,
  slowModeSeconds: 7,
};

export function useFellowshipChat(): UseFellowshipChatResult {
  const fellowship = useParableSubsystem("fellowship_chat");
  const instanceId = useId().replace(/:/g, "");
  const channelRef = useRef<Awaited<ReturnType<typeof createRealtimeChannel>> | null>(null);
  const syncAbortRef = useRef<AbortController | null>(null);
  const shouldFetchRef = useRef(fellowship.shouldFetch);
  const shouldAllowRealtimeRef = useRef(fellowship.shouldAllowRealtime);

  const [messages, setMessages] = useState<FellowshipChatMessage[]>([]);
  const [pinned, setPinned] = useState<FellowshipChatMessage | null>(null);
  const [session, setSession] = useState<FellowshipChatSession>(DEFAULT_SESSION);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usePollingFallback, setUsePollingFallback] = useState(false);

  const syncFeed = useCallback(async () => {
    if (!shouldFetchRef.current()) {
      setIsLoading(false);
      setError("Fellowship Chat paused to protect live stream.");
      return;
    }

    syncAbortRef.current?.abort();
    const abortController = new AbortController();
    syncAbortRef.current = abortController;

    try {
      const response = await fetch(`${getClientAppUrl()}/api/experience/fellowship-chat`, {
        cache: "no-store",
        credentials: "include",
        signal: abortController.signal,
      });

      if (abortController.signal.aborted) return;

      if (!response.ok) {
        throw new Error(`feed unavailable (${response.status})`);
      }

      const payload = (await response.json()) as FellowshipChatPayload;
      if (abortController.signal.aborted) return;

      setMessages(payload.messages);
      setPinned(payload.pinned);
      setSession(payload.session);
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

      console.error("🎛️ Live Chat Sync suspended temporarily:", syncError);
      setUsePollingFallback(true);
      setError("Fellowship Chat is temporarily unavailable.");
    } finally {
      if (!abortController.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    shouldFetchRef.current = fellowship.shouldFetch;
    shouldAllowRealtimeRef.current = fellowship.shouldAllowRealtime;
  }, [fellowship.shouldAllowRealtime, fellowship.shouldFetch]);

  useEffect(() => {
    return () => {
      syncAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    queueMicrotask(() => void syncFeed());
  }, [syncFeed]);

  useEffect(() => {
    if (!usePollingFallback || fellowship.isIsolated || fellowship.safeMode) return;
    const intervalId = window.setInterval(() => {
      void syncFeed();
    }, POLL_FALLBACK_MS);
    return () => window.clearInterval(intervalId);
  }, [fellowship.isIsolated, fellowship.safeMode, syncFeed, usePollingFallback]);

  useEffect(() => {
    if (!shouldAllowRealtimeRef.current()) {
      queueMicrotask(() => setUsePollingFallback(true));
      return;
    }

    let cancelled = false;
    let supabase: ReturnType<typeof getSupabase>;
    let setupPromise: Promise<void> = Promise.resolve();

    try {
      supabase = getSupabase();
    } catch (initError) {
      console.error("Fellowship chat realtime init failed:", initError);
      queueMicrotask(() => setUsePollingFallback(true));
      return;
    }

    const channelName = buildChannelName(FELLOWSHIP_CHAT_CHANNEL, instanceId);

    setupPromise = (async () => {
      try {
        const channel = await createRealtimeChannel(supabase, channelName, {
          postgres: [
            {
              event: "INSERT",
              schema: "public",
              table: "chat_messages",
              callback: (payload) => {
                const row = payload.new as FellowshipChatMessageRow;
                if (row.deleted_at) return;
                setMessages((current) =>
                  row.is_pinned
                    ? current
                    : mergeFellowshipMessages(current, mapFellowshipChatRow(row)),
                );
                if (row.is_pinned) {
                  setPinned(mapFellowshipChatRow(row));
                }
              },
            },
            {
              event: "UPDATE",
              schema: "public",
              table: "chat_messages",
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
        console.error("Fellowship chat subscribe failed:", subscribeError);
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
  }, [fellowship.isIsolated, fellowship.safeMode, instanceId, syncFeed]);

  const sendMessage = useCallback(
    async (rawContent: string): Promise<boolean> => {
      const content = rawContent.trim();
      if (!content) return false;

      if (!session.authenticated) {
        setError("Sign in to join chat.");
        return false;
      }

      if (!session.canSend) {
        setError("You are temporarily muted in Fellowship Chat.");
        return false;
      }

      if (content.length > FELLOWSHIP_MAX_CONTENT_LENGTH) {
        setError(`Messages must be ${FELLOWSHIP_MAX_CONTENT_LENGTH} characters or fewer.`);
        return false;
      }

      setIsSending(true);
      setError(null);

      try {
        const response = await fetch(`${getClientAppUrl()}/api/experience/fellowship-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content }),
        });

        const data = (await response.json()) as {
          message?: FellowshipChatMessageRow;
          error?: string;
        };

        if (response.status === 401) {
          setError("Sign in to join chat.");
          return false;
        }

        if (!response.ok || !data.message) {
          setError(data.error ?? "Unable to send message.");
          return false;
        }

        const mapped = mapFellowshipChatRow(data.message);
        if (!mapped.isPinned) {
          setMessages((current) => mergeFellowshipMessages(current, mapped));
        }
        return true;
      } catch (sendError) {
        console.error("Fellowship chat send failed:", sendError);
        setError("Unable to send message. Please try again.");
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [session.authenticated, session.canSend],
  );

  const moderate = useCallback(
    async (body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
      try {
        const response = await fetch(
          `${getClientAppUrl()}/api/experience/fellowship-chat/moderate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
          },
        );

        const data = (await response.json()) as { error?: string };
        if (!response.ok) {
          return { ok: false, error: data.error ?? "Moderation action failed." };
        }

        await syncFeed();
        return { ok: true };
      } catch (moderateError) {
        console.error("Fellowship chat moderation failed:", moderateError);
        return { ok: false, error: "Moderation action failed." };
      }
    },
    [syncFeed],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    messages,
    pinned,
    session,
    isLoading,
    isSending,
    error,
    sendMessage,
    moderate,
    clearError,
    refresh: syncFeed,
  };
}
