import { mapChatRow, sortChatMessages } from "@/lib/live/chat";
import type { ChatMessage } from "@/lib/live/types";

export const FELLOWSHIP_CHAT_HISTORY_LIMIT = 100;
export const FELLOWSHIP_MAX_CONTENT_LENGTH = 200;
export const FELLOWSHIP_SLOW_MODE_SECONDS = 7;

export type FellowshipChatMessageRow = {
  id: string;
  user_id: string;
  email: string;
  content: string;
  created_at: string;
  deleted_at?: string | null;
  is_pinned?: boolean;
  pinned_at?: string | null;
};

export type FellowshipChatMessage = ChatMessage & {
  userId: string;
  isPinned: boolean;
};

export type FellowshipChatSession = {
  authenticated: boolean;
  canSend: boolean;
  isModerator: boolean;
  mutedUntil: string | null;
  slowModeSeconds: number;
};

export type FellowshipChatPayload = {
  messages: FellowshipChatMessage[];
  pinned: FellowshipChatMessage | null;
  session: FellowshipChatSession;
};

export function mapFellowshipChatRow(row: FellowshipChatMessageRow): FellowshipChatMessage {
  const base = mapChatRow(row);
  return {
    ...base,
    userId: row.user_id,
    isPinned: row.is_pinned === true,
  };
}

export function isFellowshipRowVisible(row: FellowshipChatMessageRow): boolean {
  return !row.deleted_at;
}

export function mergeFellowshipMessages(
  current: FellowshipChatMessage[],
  incoming: FellowshipChatMessage,
): FellowshipChatMessage[] {
  const withoutIncoming = current.filter((message) => message.id !== incoming.id);
  const next = sortChatMessages([...withoutIncoming, incoming]) as FellowshipChatMessage[];
  return next.slice(-FELLOWSHIP_CHAT_HISTORY_LIMIT);
}

export function removeFellowshipMessage(
  current: FellowshipChatMessage[],
  messageId: string,
): FellowshipChatMessage[] {
  return current.filter((message) => message.id !== messageId);
}
