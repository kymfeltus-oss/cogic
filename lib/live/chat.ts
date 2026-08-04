import type { ChatMessage, ChatMessageRow } from "@/lib/live/types";

export function formatChatAuthor(email: string): string {
  const localPart = email.split("@")[0]?.trim();
  return localPart || "Guest";
}

export function mapChatRow(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    author: formatChatAuthor(row.email),
    body: row.content,
    createdAt: row.created_at,
  };
}

export function sortChatMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function mergeChatMessage(
  current: ChatMessage[],
  incoming: ChatMessage,
): ChatMessage[] {
  if (current.some((message) => message.id === incoming.id)) {
    return current;
  }

  return sortChatMessages([...current, incoming]);
}
