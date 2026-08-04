/** Native Supabase broadcast channel for live attendee Fellowship Chat. */

export const REALTIME_ATTENDEE_CHAT_CHANNEL = "realtime_attendee_chat";

export const ATTENDEE_CHAT_MESSAGE_EVENT = "attendee_chat_message";

export type AttendeeChatBroadcastPayload = {
  id: string;
  user_id: string;
  email: string;
  content: string;
  created_at: string;
};

export function isAttendeeChatBroadcastPayload(
  value: unknown,
): value is AttendeeChatBroadcastPayload {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.user_id === "string" &&
    typeof row.email === "string" &&
    typeof row.content === "string" &&
    typeof row.created_at === "string"
  );
}
