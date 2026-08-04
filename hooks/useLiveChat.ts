"use client";

import { useCallback, useMemo } from "react";
import type { LiveChatMessage, LiveChatMessageColor } from "@/lib/liveChatStore";
import { useLiveRoomChat } from "@/lib/useLiveRoomChat";
import type { ChatMessage } from "@/lib/live/types";

const COLORS: LiveChatMessageColor[] = ["pink", "cyan", "purple", "green", "blue"];

function initialsFromAuthor(author: string): string {
  const parts = author.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "GU";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function colorForId(id: string): LiveChatMessageColor {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i) * (i + 1)) % COLORS.length;
  }
  return COLORS[hash] ?? "cyan";
}

function mapRoomMessage(message: ChatMessage): LiveChatMessage {
  return {
    id: message.id,
    userName: message.author,
    initials: initialsFromAuthor(message.author),
    color: colorForId(message.id),
    text: message.body,
    createdAt: new Date(message.createdAt).getTime() || Date.now(),
    type: "message",
  };
}

/**
 * Attendee live chat backed by persisted chat_messages + realtime.
 * No fake seed messages or simulated incoming traffic.
 */
export function useLiveChat(_streamId: string) {
  const room = useLiveRoomChat();

  const messages = useMemo(
    () => room.messages.map(mapRoomMessage),
    [room.messages],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return null;
      void room.sendMessage(trimmed);
      return null;
    },
    [room],
  );

  const sendSeedMessage = useCallback((_seedAmount: number) => null, []);

  const sendPrayerMessage = useCallback(() => null, []);

  return {
    messages,
    isLoading: room.isLoading,
    isSending: room.isSending,
    error: room.error,
    clearError: room.clearError,
    sendMessage,
    sendSeedMessage,
    sendPrayerMessage,
  };
}
