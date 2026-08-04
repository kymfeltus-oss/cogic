"use client";

import { FormEvent, useState } from "react";
import { Send, Smile } from "lucide-react";

const QUICK_EMOJIS = ["🙏", "✨", "🔥", "❤️", "🎉"];

type LiveChatInputProps = {
  onSend: (text: string) => void;
};

export default function LiveChatInput({ onSend }: LiveChatInputProps) {
  const [draft, setDraft] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setDraft("");
    setShowEmoji(false);
  };

  return (
    <div className="absolute inset-x-0 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] z-40 px-3">
      {showEmoji ? (
        <div className="mb-2 flex gap-2 rounded-full border border-white/10 bg-black/55 px-3 py-2 backdrop-blur-md">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="touch-target text-lg"
              onClick={() => setDraft((current) => `${current}${emoji}`)}
              aria-label={`Insert ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <label className="sr-only" htmlFor="fullscreen-live-chat-input">
          Join the conversation
        </label>
        <button
          type="button"
          onClick={() => setShowEmoji((open) => !open)}
          className="touch-target flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-md"
          aria-label="Insert emoji"
        >
          <Smile className="h-5 w-5" />
        </button>
        <input
          id="fullscreen-live-chat-input"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Join the conversation..."
          className="h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-black/50 px-4 font-body text-sm text-white placeholder:text-white/50 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="touch-target flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand-blue/40 bg-brand-blue/20 text-brand-blue disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
