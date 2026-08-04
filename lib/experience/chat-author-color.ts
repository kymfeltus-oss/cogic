const CHAT_AUTHOR_COLORS = [
  "exp-chat-name-blue", // #3B82F6
  "exp-chat-name-frost", // #60A5FA
  "exp-chat-name-pink", // #EC4899
  "exp-chat-name-blossom", // #F472B6
  "exp-chat-name-purple", // #A855F7
  "exp-chat-name-orchid", // #C084FC
  "exp-chat-name-rose", // #F43F5E
] as const;

export function chatAuthorColorClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CHAT_AUTHOR_COLORS.length;
  return CHAT_AUTHOR_COLORS[index];
}
