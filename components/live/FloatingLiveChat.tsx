"use client";

import { Heart, Sparkles } from "lucide-react";
import type { LiveChatMessage } from "@/lib/liveChatStore";

const COLOR_CLASS: Record<LiveChatMessage["color"], string> = {
  pink: "text-brand-pink",
  cyan: "text-brand-blue",
  purple: "text-brand-purple",
  green: "text-emerald-400",
  blue: "text-brand-blue",
};

const VISIBLE_LIMIT = 6;

type FloatingLiveChatProps = {
  messages: LiveChatMessage[];
};

export default function FloatingLiveChat({ messages }: FloatingLiveChatProps) {
  const visible = messages.slice(-VISIBLE_LIMIT);

  if (visible.length === 0) {
    return (
      <div
        className="pointer-events-none absolute bottom-[calc(11.5rem+env(safe-area-inset-bottom))] left-3 z-30 w-[min(78%,20rem)]"
        aria-live="polite"
        aria-label="Live chat"
      >
        <p className="rounded-xl bg-black/40 px-3 py-2 font-body text-xs text-white/65 backdrop-blur-sm">
          No chat messages yet.
        </p>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute bottom-[calc(11.5rem+env(safe-area-inset-bottom))] left-3 z-30 max-h-[38dvh] w-[min(78%,20rem)] overflow-hidden"
      aria-live="polite"
      aria-label="Live chat"
    >
      <div className="flex flex-col justify-end gap-2.5 [mask-image:linear-gradient(to_top,black_72%,transparent_100%)]">
        {visible.map((message) => (
          <div
            key={message.id}
            className="live-chat-float-in flex items-start gap-2 [text-shadow:0_1px_8px_rgba(0,0,0,0.75)]"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/45 font-ui text-[0.58rem] font-bold text-white ring-1 ring-white/15 backdrop-blur-sm">
              {message.initials}
            </span>
            <div className="min-w-0">
              <p className="font-body text-[0.9rem] leading-snug text-white">
                <span className={`font-ui text-xs font-bold ${COLOR_CLASS[message.color]}`}>
                  {message.userName}
                </span>{" "}
                {message.type === "seed" ? (
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="inline h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                    {message.text}
                  </span>
                ) : (
                  message.text
                )}
              </p>
              {message.likeCount && message.likeCount > 0 ? (
                <p className="mt-0.5 flex items-center gap-1 font-ui text-[0.58rem] text-white/70">
                  <Heart className="h-3 w-3 text-brand-pink" aria-hidden="true" />
                  {message.likeCount}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
