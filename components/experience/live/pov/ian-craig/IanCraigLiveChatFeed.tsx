"use client";

import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { chatAuthorColorClass } from "@/lib/experience/chat-author-color";
import type { IanCraigChatLine } from "@/components/experience/live/pov/ian-craig/ian-craig-live-types";

type IanCraigLiveChatFeedProps = {
  lines: IanCraigChatLine[];
  variant: "overlay" | "sidebar";
};

export default function IanCraigLiveChatFeed({ lines, variant }: IanCraigLiveChatFeedProps) {
  if (variant === "sidebar") {
    if (lines.length === 0) {
      return (
        <p className="font-body text-sm text-brand-muted">Be the first to join the conversation.</p>
      );
    }

    return (
      <div className="flex flex-col gap-3" aria-live="polite" aria-label="Live chat">
        {lines.map((line) => (
          <ChatLine key={line.id} line={line} variant="sidebar" />
        ))}
      </div>
    );
  }

  const wrapperClass =
    "ian-craig-live-mobile-chat viewer-pov-chat-mask pointer-events-none absolute left-[clamp(0.75rem,3vw,1.25rem)] z-20 max-h-[34%] max-w-[min(82%,20rem)] overflow-hidden";

  return (
    <div className={wrapperClass} aria-live="polite" aria-label="Live chat">
      <div className="viewer-pov-chat-scroll flex flex-col justify-end gap-2.5">
        {lines.length === 0 ? (
          <p className="font-body text-xs text-white/55 viewer-pov-text-shadow">
            Fellowship Chat — say hello to the room
          </p>
        ) : (
          lines.map((line) => <ChatLine key={line.id} line={line} variant="overlay" />)
        )}
      </div>
    </div>
  );
}

function ChatLine({ line, variant }: { line: IanCraigChatLine; variant: "overlay" | "sidebar" }) {
  const colorClass = chatAuthorColorClass(line.userId);

  return (
    <div
      className={`${variant === "overlay" ? "live-chat-float-in" : "viewer-pov-glass-msg rounded-2xl px-3 py-2"} viewer-pov-text-shadow`}
    >
      <p className="font-body text-[0.9rem] leading-snug text-white">
        <span className={`font-ui text-xs font-bold ${colorClass}`}>{line.author}</span>{" "}
        {line.kind === "seed" ? (
          <span className="inline-flex items-center gap-1 text-white/95">
            <Sparkles className="inline h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
            <span aria-hidden="true">✦</span> {line.body}
          </span>
        ) : (
          line.body
        )}
      </p>
    </div>
  );
}

export function IanCraigLiveChatFeedSidebar({ lines }: { lines: IanCraigChatLine[] }) {
  return (
    <div className="viewer-pov-glass-sidebar flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 p-3">
      <p className="mb-3 shrink-0 font-ui text-[0.58rem] font-bold uppercase tracking-[0.2em] text-brand-muted">
        Fellowship Chat
      </p>
      <div id="ian-craig-sidebar-chat-scroll" className="min-h-0 flex-1 overflow-y-auto">
        <IanCraigLiveChatFeed lines={lines} variant="sidebar" />
      </div>
    </div>
  );
}

/** Auto-scroll sidebar feed when new messages arrive. */
export function useChatFeedScrollRef(messageCount: number) {
  useEffect(() => {
    const node = document.getElementById("ian-craig-sidebar-chat-scroll");
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messageCount]);
}
