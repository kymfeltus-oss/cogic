"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { mapChatRow, mergeChatMessage } from "@/lib/live/chat";
import {
  buildChannelName,
  createRealtimeChannel,
  teardownRealtimeChannel,
} from "@/lib/live/realtime-subscribe";
import type { ChatMessage, ChatMessageRow } from "@/lib/live/types";
import { LIVE_ROOM_CHAT_CHANNEL } from "@/lib/live/types";
import { getClientAppUrl } from "@/lib/client-api";
import { getSupabase } from "@/lib/supabase/client";

const CHAT_HISTORY_LIMIT = 100;
const MAX_CONTENT_LENGTH = 500;

type UseLiveRoomChatResult = {
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<boolean>;
  clearError: () => void;
};

function reportChatFailure(
  cancelled: boolean,
  setIsLoading: (value: boolean) => void,
  setError: (value: string | null) => void,
  message: string,
) {
  if (cancelled) return;

  queueMicrotask(() => {
    if (cancelled) return;
    setIsLoading(false);
    setError(message);
  });
}

export function useLiveRoomChat(): UseLiveRoomChatResult {
  const instanceId = useId().replace(/:/g, "");
  const channelRef = useRef<Awaited<ReturnType<typeof createRealtimeChannel>> | null>(
    null,
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appendMessage = useCallback((incoming: ChatMessage) => {
    setMessages((current) => mergeChatMessage(current, incoming));
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let supabase: ReturnType<typeof getSupabase>;
    let setupPromise: Promise<void> = Promise.resolve();

    try {
      supabase = getSupabase();
    } catch (initError) {
      console.error("Live chat init failed:", initError);
      reportChatFailure(
        cancelled,
        setIsLoading,
        setError,
        "Live chat is unavailable.",
      );
      return;
    }

    const channelName = buildChannelName(LIVE_ROOM_CHAT_CHANNEL, instanceId);

    setupPromise = (async () => {
      try {
        const channel = await createRealtimeChannel(supabase, channelName, {
          postgres: [
            {
              event: "INSERT",
              schema: "public",
              table: "chat_messages",
              callback: (payload) => {
                const row = payload.new as ChatMessageRow;
                appendMessage(mapChatRow(row));
              },
            },
          ],
        });

        if (cancelled) {
          await teardownRealtimeChannel(supabase, channel);
          return;
        }

        channelRef.current = channel;

        const { data, error: historyError } = await supabase
          .from("chat_messages")
          .select("id, user_id, email, content, created_at")
          .order("created_at", { ascending: true })
          .limit(CHAT_HISTORY_LIMIT);

        if (cancelled) {
          await teardownRealtimeChannel(supabase, channelRef.current);
          channelRef.current = null;
          return;
        }

        if (historyError) {
          console.error("Failed to load chat history:", historyError.message);
          reportChatFailure(
            cancelled,
            setIsLoading,
            setError,
            "Unable to load chat history.",
          );
          return;
        }

        setMessages((data ?? []).map((row) => mapChatRow(row as ChatMessageRow)));
        setIsLoading(false);
      } catch (subscribeError) {
        console.error("Live chat channel subscribe failed:", subscribeError);
        reportChatFailure(
          cancelled,
          setIsLoading,
          setError,
          "Live chat is unavailable.",
        );
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
  }, [appendMessage, instanceId]);

  const sendMessage = useCallback(async (rawContent: string): Promise<boolean> => {
    const content = rawContent.trim();

    if (!content) {
      return false;
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      setError(`Messages must be ${MAX_CONTENT_LENGTH} characters or fewer.`);
      return false;
    }

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch(`${getClientAppUrl()}/api/live/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });

      const data = (await response.json()) as {
        message?: ChatMessageRow;
        error?: string;
      };

      if (response.status === 401) {
        setError("Sign in to send messages in the live room.");
        return false;
      }

      if (!response.ok || !data.message) {
        setError(data.error ?? "Unable to send message.");
        return false;
      }

      appendMessage(mapChatRow(data.message));
      return true;
    } catch (sendError) {
      console.error("Live chat send failed:", sendError);
      setError("Unable to send message. Please try again.");
      return false;
    } finally {
      setIsSending(false);
    }
  }, [appendMessage]);

  return {
    messages,
    isLoading,
    isSending,
    error,
    sendMessage,
    clearError,
  };
}
