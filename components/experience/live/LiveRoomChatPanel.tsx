"use client";

import { useState, type FormEvent } from "react";
import { useLiveRoomChat } from "@/lib/useLiveRoomChat";

/** Live chat feed + composer — real authenticated messages only (no fake counts). */
export default function LiveRoomChatPanel({ enabled }: { enabled: boolean }) {
  const chat = useLiveRoomChat();
  const [draft, setDraft] = useState("");

  if (!enabled) return null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || chat.isSending) return;
    const ok = await chat.sendMessage(body);
    if (ok) setDraft("");
  }

  return (
    <aside
      className="rounded-xl border border-white/10 bg-black/55 px-4 py-3"
      aria-label="Live chat"
    >
      {chat.isLoading ? (
        <p className="font-body text-xs text-white/55">Loading chat…</p>
      ) : chat.error ? (
        <div className="flex items-center justify-between gap-3">
          <p className="font-body text-xs text-white/70" role="alert">
            Chat is unavailable right now.
          </p>
          <button
            type="button"
            onClick={chat.clearError}
            className="min-h-9 rounded-full border border-white/15 px-3 font-ui text-[0.58rem] font-bold uppercase tracking-[0.12em] text-white"
          >
            Dismiss
          </button>
        </div>
      ) : chat.messages.length === 0 ? (
        <p className="font-body text-xs text-white/55">No chat messages yet.</p>
      ) : (
        <ul className="max-h-36 space-y-1.5 overflow-y-auto">
          {chat.messages.slice(-12).map((message) => (
            <li key={message.id} className="font-body text-xs text-white/80">
              <span className="font-semibold text-brand-blue">{message.author}</span>{" "}
              {message.body}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={(event) => void onSubmit(event)} className="mt-3 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={500}
          placeholder="Share a message"
          className="min-h-11 flex-1 rounded-full border border-white/15 bg-white/5 px-4 font-body text-sm text-white placeholder:text-white/40"
          aria-label="Chat message"
        />
        <button
          type="submit"
          disabled={chat.isSending || draft.trim().length === 0}
          className="min-h-11 rounded-full border border-brand-blue/40 bg-brand-blue/15 px-4 font-ui text-[0.62rem] font-bold uppercase tracking-[0.12em] text-brand-blue disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </aside>
  );
}
