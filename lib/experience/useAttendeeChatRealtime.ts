"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ATTENDEE_CHAT_MESSAGE_EVENT,
  isAttendeeChatBroadcastPayload,
  REALTIME_ATTENDEE_CHAT_CHANNEL,
  type AttendeeChatBroadcastPayload,
} from "@/lib/experience/attendee-chat-realtime";
import {
  mapFellowshipChatRow,
  mergeFellowshipMessages,
  type FellowshipChatMessage,
  type FellowshipChatMessageRow,
  type FellowshipChatPayload,
} from "@/lib/experience/fellowship-chat";
import {
  buildChannelName,
  createRealtimeChannel,
  teardownRealtimeChannel,
} from "@/lib/live/realtime-subscribe";
import { getClientAppUrl } from "@/lib/client-api";
import { getSupabase } from "@/lib/supabase/client";

const POLL_FALLBACK_MS = 15_000;
const MONITOR_HISTORY_LIMIT = 40;

type UseAttendeeChatRealtimeOptions = {
  enabled?: boolean;
  /** Fires for each newly received message (broadcast or postgres). */
  onMessage?: (message: FellowshipChatMessage) => void;
};

type UseAttendeeChatRealtimeResult = {
  messages: FellowshipChatMessage[];
  isLoading: boolean;
  isConnected: boolean;
};

function mapBroadcastPayload(payload: AttendeeChatBroadcastPayload): FellowshipChatMessage {
  return mapFellowshipChatRow({
    id: payload.id,
    user_id: payload.user_id,
    email: payload.email,
    content: payload.content,
    created_at: payload.created_at,
    is_pinned: false,
    deleted_at: null,
  } as FellowshipChatMessageRow);
}

function mergeHistory(
  current: FellowshipChatMessage[],
  history: FellowshipChatMessage[],
): FellowshipChatMessage[] {
  return history
    .reduce(
      (accumulator, message) => mergeFellowshipMessages(accumulator, message),
      current,
    )
    .slice(-MONITOR_HISTORY_LIMIT);
}


/** Subscribe to native `realtime_attendee_chat` + hydrate from Fellowship Chat API. */
export function useAttendeeChatRealtime(
  options: UseAttendeeChatRealtimeOptions = {},
): UseAttendeeChatRealtimeResult {
  const { enabled = true, onMessage } = options;
  const instanceId = useId().replace(/:/g, "");
  const channelRef = useRef<Awaited<ReturnType<typeof createRealtimeChannel>> | null>(null);
  const syncAbortRef = useRef<AbortController | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const onMessageRef = useRef(onMessage);

  onMessageRef.current = onMessage;

  const [messages, setMessages] = useState<FellowshipChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [usePollingFallback, setUsePollingFallback] = useState(false);

  const ingestMessage = useCallback((message: FellowshipChatMessage) => {
    if (seenMessageIdsRef.current.has(message.id)) return;
    seenMessageIdsRef.current.add(message.id);

    setMessages((current) =>
      mergeFellowshipMessages(current, message).slice(-MONITOR_HISTORY_LIMIT),
    );
    onMessageRef.current?.(message);
  }, []);

  const syncFeed = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
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

      const history = payload.messages
        .filter((message) => !message.isPinned)
        .slice(-MONITOR_HISTORY_LIMIT);

      setMessages((current) => {
        const merged = mergeHistory(current, history);
        seenMessageIdsRef.current = new Set(merged.map((message) => message.id));
        return merged;
      });

      setUsePollingFallback(false);
    } catch (syncError) {
      if (
        abortController.signal.aborted ||
        (syncError instanceof DOMException && syncError.name === "AbortError") ||
        (syncError instanceof Error && syncError.name === "AbortError")
      ) {
        return;
      }
      console.error("Attendee chat realtime sync failed:", syncError);
      setUsePollingFallback(true);
    } finally {
      if (!abortController.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    return () => {
      syncAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setMessages([]);
      seenMessageIdsRef.current.clear();
      setIsLoading(false);
      setIsConnected(false);
      return;
    }

    setIsLoading(true);
    void syncFeed();
  }, [enabled, syncFeed]);

  useEffect(() => {
    if (!enabled || !usePollingFallback) return;

    const intervalId = window.setInterval(() => {
      void syncFeed();
    }, POLL_FALLBACK_MS);

    return () => window.clearInterval(intervalId);
  }, [enabled, syncFeed, usePollingFallback]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let supabase: ReturnType<typeof getSupabase>;
    let setupPromise: Promise<void> = Promise.resolve();
    const channelName = buildChannelName(REALTIME_ATTENDEE_CHAT_CHANNEL, instanceId);

    try {
      supabase = getSupabase();
    } catch (initError) {
      console.error("Attendee chat realtime init failed:", initError);
      setUsePollingFallback(true);
      setIsConnected(false);
      return;
    }

    setupPromise = (async () => {
      try {
        const channel = await createRealtimeChannel(
          supabase,
          channelName,
          {
            broadcast: [
              {
                event: ATTENDEE_CHAT_MESSAGE_EVENT,
                callback: ({ payload }) => {
                  if (!isAttendeeChatBroadcastPayload(payload)) {
                    return;
                  }
                  ingestMessage(mapBroadcastPayload(payload));
                },
              },
            ],
            postgres: [
              {
                event: "INSERT",
                schema: "public",
                table: "chat_messages",
                callback: (payload) => {
                  const row = payload.new as FellowshipChatMessageRow | null;
                  if (!row || row.deleted_at || row.is_pinned) return;
                  ingestMessage(mapFellowshipChatRow(row));
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
          },
          (status) => {
            if (cancelled) return;
            setIsConnected(status === "SUBSCRIBED");
          },
          { broadcast: { self: false, ack: false } },
        );

        if (cancelled) {
          await teardownRealtimeChannel(supabase, channel);
          return;
        }

        channelRef.current = channel;
        setUsePollingFallback(false);
      } catch (subscribeError) {
        console.error("Attendee chat realtime subscribe failed:", subscribeError);
        if (!cancelled) {
          setUsePollingFallback(true);
          setIsConnected(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      setIsConnected(false);
      void (async () => {
        await setupPromise;
        const channel = channelRef.current;
        channelRef.current = null;
        await teardownRealtimeChannel(supabase, channel);
      })();
    };
  }, [enabled, ingestMessage, instanceId, syncFeed]);

  return {
    messages,
    isLoading,
    isConnected,
  };
}
