export type ChatMessageVariant = "default" | "giving" | "prayer" | "broadcast";

/** Client-side styling hints — does not change chat persistence or APIs. */
export function classifyChatMessageVariant(body: string): ChatMessageVariant {
  const trimmed = body.trim();
  if (/^\[(broadcast|mod|host|announcement)\]/i.test(trimmed)) return "broadcast";
  if (/\b(sow|sowed|seed|gift|donat|vital seed|frequency|🌱)\b/i.test(trimmed)) return "giving";
  if (/\b(pray|prayer|amen|interced|🙏)\b/i.test(trimmed)) return "prayer";
  return "default";
}

export function formatChatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
