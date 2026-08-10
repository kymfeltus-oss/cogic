"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, MessageSquareText, Send, X } from "lucide-react";
import {
  buildChannelName,
  createRealtimeChannel,
  teardownRealtimeChannel,
} from "@/lib/live/realtime-subscribe";
import type { DirectMessage, DmConversationSummary } from "@/lib/social/dms-types";
import { getSupabase } from "@/lib/supabase/client";

type Props = {
  currentUserId: string | null;
  initialRecipientId: string | null;
  onClose: () => void;
};

type DmRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  message_body?: string;
  media_urls?: string[] | null;
  read_at?: string | null;
  created_at: string;
};

function shortPeer(id: string) {
  return `Member ${id.slice(0, 8)}`;
}

function mapDmRow(row: DmRow): DirectMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    body: String(row.message_body || ""),
    mediaUrls: Array.isArray(row.media_urls) ? row.media_urls : [],
    readAt: row.read_at ?? null,
    readStatus: row.read_at ? "read" : "unread",
    createdAt: row.created_at,
  };
}

function mergeMessage(current: DirectMessage[], incoming: DirectMessage): DirectMessage[] {
  if (current.some((message) => message.id === incoming.id)) return current;
  return [...current, incoming];
}

export default function DMOverlayPopup({
  currentUserId,
  initialRecipientId,
  onClose,
}: Props) {
  const instanceId = useId().replace(/:/g, "");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"inbox" | "chat">(
    initialRecipientId ? "chat" : "inbox",
  );
  const [recipientId, setRecipientId] = useState<string | null>(initialRecipientId);
  const [conversations, setConversations] = useState<DmConversationSummary[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = 200 - messageText.length;

  function scrollToBottom(smooth = true) {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "end",
    });
  }

  useEffect(() => {
    setRecipientId(initialRecipientId);
    setActiveTab(initialRecipientId ? "chat" : "inbox");
  }, [initialRecipientId]);

  useEffect(() => {
    void loadInbox();
  }, []);

  useEffect(() => {
    if (recipientId && activeTab === "chat") {
      void loadChatThread(recipientId);
    }
  }, [recipientId, activeTab]);

  useEffect(() => {
    scrollToBottom(messages.length > 1);
  }, [messages]);

  useEffect(() => {
    if (!currentUserId) return;

    let cancelled = false;
    let supabase: ReturnType<typeof getSupabase>;
    let setupPromise: Promise<void> = Promise.resolve();
    let channel: Awaited<ReturnType<typeof createRealtimeChannel>> | null = null;

    try {
      supabase = getSupabase();
    } catch (initError) {
      console.error("DM realtime init failed:", initError);
      return;
    }

    const channelName = buildChannelName(
      `dm-${currentUserId}-${recipientId || "inbox"}`,
      instanceId,
    );

    setupPromise = (async () => {
      try {
        channel = await createRealtimeChannel(supabase, channelName, {
          postgres: [
            {
              event: "INSERT",
              schema: "public",
              table: "direct_messages",
              callback: (payload) => {
                const row = payload.new as DmRow;
                if (!row?.id || !currentUserId) return;

                const involvesUser =
                  row.sender_id === currentUserId || row.recipient_id === currentUserId;
                if (!involvesUser) return;

                void loadInbox();

                if (activeTab !== "chat" || !recipientId) return;

                const isRelevant =
                  (row.sender_id === currentUserId && row.recipient_id === recipientId) ||
                  (row.sender_id === recipientId && row.recipient_id === currentUserId);
                if (!isRelevant) return;

                setMessages((prev) => mergeMessage(prev, mapDmRow(row)));
              },
            },
          ],
        });

        if (cancelled) {
          await teardownRealtimeChannel(supabase, channel);
          channel = null;
        }
      } catch (subscribeError) {
        console.error("DM realtime subscribe failed:", subscribeError);
      }
    })();

    return () => {
      cancelled = true;
      void (async () => {
        await setupPromise;
        await teardownRealtimeChannel(supabase, channel);
      })();
    };
  }, [activeTab, currentUserId, instanceId, recipientId]);

  async function loadInbox() {
    try {
      const res = await fetch("/api/social/dms", { credentials: "include", cache: "no-store" });
      const data = (await res.json()) as {
        conversations?: DmConversationSummary[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Unable to load inbox.");
      setConversations(data.conversations ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load inbox.");
    }
  }

  async function loadChatThread(targetId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/social/dms?recipient_id=${encodeURIComponent(targetId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as { messages?: DirectMessage[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Unable to load conversation.");
      setMessages(data.messages ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load conversation.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!messageText.trim() || !recipientId || sending) return;

    const tempText = messageText.trim();
    setMessageText("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/social/dms", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId, body: tempText }),
      });
      const data = (await res.json()) as { message?: DirectMessage; error?: string };
      if (!res.ok) {
        setMessageText(tempText);
        throw new Error(data.error || "Message delivery failed.");
      }
      if (data.message) {
        setMessages((prev) => mergeMessage(prev, data.message as DirectMessage));
      }
      void loadInbox();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Message delivery failed.");
    } finally {
      setSending(false);
    }
  }

  const title = useMemo(
    () => (activeTab === "inbox" ? "Private messaging" : shortPeer(recipientId || "")),
    [activeTab, recipientId],
  );

  return (
    <div className="social-dm" role="dialog" aria-modal="true" aria-label="Direct messages">
      <button
        type="button"
        className="social-dm__backdrop"
        aria-label="Close messages"
        onClick={onClose}
      />
      <aside className="social-dm__panel">
        <header className="social-dm__header">
          <div>
            <h2>{title}</h2>
            {activeTab === "chat" ? (
              <button
                type="button"
                className="social-dm__back"
                onClick={() => {
                  setActiveTab("inbox");
                  setRecipientId(null);
                  void loadInbox();
                }}
              >
                <ArrowLeft aria-hidden="true" /> Back to inbox
              </button>
            ) : null}
          </div>
          <button type="button" className="social-dm__close" aria-label="Close" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </header>

        {error ? (
          <p className="social-dm__error" role="alert">
            {error}
          </p>
        ) : null}

        {activeTab === "inbox" ? (
          <div className="social-dm__list">
            {conversations.length === 0 ? (
              <div className="social-dm__empty">
                <MessageSquareText aria-hidden="true" />
                <p>Your message history is currently empty.</p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <button
                  key={conversation.peerUserId}
                  type="button"
                  className="social-dm__conversation"
                  onClick={() => {
                    setRecipientId(conversation.peerUserId);
                    setActiveTab("chat");
                  }}
                >
                  <strong>{shortPeer(conversation.peerUserId)}</strong>
                  <span>{conversation.lastBody}</span>
                  {conversation.unreadCount > 0 ? (
                    <em>{conversation.unreadCount} unread</em>
                  ) : null}
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="social-dm__thread">
            <div className="social-dm__messages">
              {loading ? (
                <p className="social-dm__empty">Syncing secure history…</p>
              ) : messages.length === 0 ? (
                <p className="social-dm__empty">Start the conversation with a short note.</p>
              ) : (
                messages.map((message) => {
                  const isMe = message.senderId === currentUserId;
                  return (
                    <div
                      key={message.id}
                      className={`social-dm__bubble${isMe ? " social-dm__bubble--me" : ""}`}
                    >
                      <p>{message.body}</p>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            <form className="social-dm__composer" onSubmit={(event) => void handleSendMessage(event)}>
              <input
                type="text"
                maxLength={200}
                placeholder="Send message…"
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                aria-label="Direct message"
              />
              <span>{remaining}</span>
              <button type="submit" disabled={!messageText.trim() || sending || !recipientId}>
                <Send aria-hidden="true" />
                {sending ? "…" : "Send"}
              </button>
            </form>
          </div>
        )}
      </aside>
    </div>
  );
}
