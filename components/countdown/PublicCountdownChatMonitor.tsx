"use client";

import { useEffect, useRef } from "react";
import { chatAuthorColorClass } from "@/lib/experience/chat-author-color";
import type { FellowshipChatMessage } from "@/lib/experience/fellowship-chat";

export type PublicCountdownChatMonitorLayout = "sidebar" | "ticker";

/** overlay = fixed dock (public countdown). embedded = in-flow panel (ops editor). */
export type PublicCountdownChatMonitorPlacement = "overlay" | "embedded";

type PublicCountdownChatMonitorProps = {
  messages: FellowshipChatMessage[];
  isLoading: boolean;
  isConnected: boolean;
  layout?: PublicCountdownChatMonitorLayout;
  placement?: PublicCountdownChatMonitorPlacement;
};

function ChatTickerRow({
  messages,
  duplicate = false,
}: {
  messages: FellowshipChatMessage[];
  duplicate?: boolean;
}) {
  if (messages.length === 0) return null;

  const keySuffix = duplicate ? "-dup" : "";

  return (
    <>
      {messages.map((message) => (
        <span
          key={`${message.id}${keySuffix}`}
          className="public-countdown-chat-monitor__item font-body"
        >
          <span
            className={`public-countdown-chat-monitor__author font-ui ${chatAuthorColorClass(message.userId)}`}
          >
            {message.author}:
          </span>{" "}
          <span className="public-countdown-chat-monitor__body">{message.body}</span>
          <span className="public-countdown-chat-monitor__sep" aria-hidden="true">
            •
          </span>
        </span>
      ))}
    </>
  );
}

function ChatTickerTrack({ messages }: { messages: FellowshipChatMessage[] }) {
  const durationSeconds = Math.max(28, messages.length * 5);

  return (
    <div
      className="public-countdown-chat-monitor__track"
      style={{ ["--chat-monitor-duration" as string]: `${durationSeconds}s` }}
    >
      <span className="public-countdown-chat-monitor__track-inner">
        <ChatTickerRow messages={messages} />
      </span>
      <span className="public-countdown-chat-monitor__track-inner" aria-hidden="true">
        <ChatTickerRow messages={messages} duplicate />
      </span>
    </div>
  );
}

function ChatSidebarList({ messages }: { messages: FellowshipChatMessage[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  return (
    <div ref={scrollRef} className="public-countdown-chat-monitor__sidebar-scroll">
      {messages.length === 0 ? (
        <p className="public-countdown-chat-monitor__empty font-body">
          Messages from the live experience will appear here.
        </p>
      ) : (
        messages.map((message) => (
          <p key={message.id} className="public-countdown-chat-monitor__sidebar-line font-body">
            <span
              className={`public-countdown-chat-monitor__author font-ui ${chatAuthorColorClass(message.userId)}`}
            >
              {message.author}:
            </span>{" "}
            <span className="public-countdown-chat-monitor__body">{message.body}</span>
          </p>
        ))
      )}
    </div>
  );
}

/** Real-time attendee chat monitor for countdown production layouts. */
export default function PublicCountdownChatMonitor({
  messages,
  isLoading,
  isConnected,
  layout = "sidebar",
  placement = "overlay",
}: PublicCountdownChatMonitorProps) {
  const statusLabel = isLoading
    ? "Syncing…"
    : isConnected
      ? "Live"
      : "Listening";

  const layoutClass =
    layout === "ticker"
      ? "public-countdown-chat-monitor--ticker"
      : "public-countdown-chat-monitor--sidebar";

  const placementClass =
    placement === "embedded"
      ? "public-countdown-chat-monitor--embedded"
      : "public-countdown-chat-monitor--overlay";

  return (
    <aside
      className={`public-countdown-chat-monitor ${layoutClass} ${placementClass}`}
      aria-label="Live chat monitor"
      data-connected={isConnected ? "true" : "false"}
    >
      <div className="public-countdown-chat-monitor__shell">
        <div className="public-countdown-chat-monitor__badge font-ui">
          <span
            className="public-countdown-chat-monitor__badge-dot"
            aria-hidden="true"
            data-live={isConnected ? "true" : "false"}
          />
          Live Chat
          <span className="public-countdown-chat-monitor__badge-meta">{statusLabel}</span>
        </div>

        {layout === "ticker" ? (
          <div className="public-countdown-chat-monitor__viewport">
            {messages.length > 0 ? (
              <ChatTickerTrack messages={messages} />
            ) : (
              <p className="public-countdown-chat-monitor__empty font-body">
                {isLoading
                  ? "Loading fellowship chat…"
                  : "Messages from the live experience will scroll here."}
              </p>
            )}
          </div>
        ) : (
          <ChatSidebarList messages={messages} />
        )}
      </div>
    </aside>
  );
}
