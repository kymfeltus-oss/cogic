"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useIgLiveChat } from "@/components/experience/live/ig/IgLiveChatContext";
import { mapFellowshipToIanCraigLine } from "@/components/experience/live/pov/ian-craig/ian-craig-live-types";
import { buildAttendeeGateUrl } from "@/lib/auth/routing";
import { chatAuthorColorClass } from "@/lib/experience/chat-author-color";
import { FELLOWSHIP_MAX_CONTENT_LENGTH } from "@/lib/experience/fellowship-chat";
import { EXPERIENCE_LIVE_PATH } from "@/lib/experience/live-routes";

const CHAT_VISIBLE_LIMIT = 12;

/** Fellowship chat feed + composer overlaid on the holding-room artboard. */
export default function HoldingRoomFellowshipChat() {
  const { messages, session, isSending, error, sendMessage } = useIgLiveChat();
  const [draft, setDraft] = useState("");

  const chatLines = useMemo(
    () => messages.slice(-CHAT_VISIBLE_LIMIT).map(mapFellowshipToIanCraigLine),
    [messages],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isSending || !session.canSend) return;

    void sendMessage(trimmed).then((sent) => {
      if (sent) setDraft("");
    });
  };

  return (
    <div className="holding-room-page__chat-layer">
      <p className="holding-room-page__chat-label font-ui">Fellowship Chat</p>

      <div className="holding-room-page__chat-feed" aria-live="polite" aria-label="Fellowship Chat">
        {chatLines.length === 0 ? (
          <p className="holding-room-page__chat-empty font-body text-xs text-white/70">
            Fellowship Chat is open — say hello while we count down to go live.
          </p>
        ) : (
          chatLines.map((line) => (
            <p key={line.id} className="holding-room-page__chat-line font-body text-xs text-white/90">
              <span className={chatAuthorColorClass(line.userId)}>{line.author}</span>
              <span className="text-white/80">: {line.body}</span>
            </p>
          ))
        )}
      </div>

      {!session.authenticated ? (
        <div className="holding-room-page__chat-composer">
          <p className="font-body text-xs text-white/75">Sign in to join the conversation</p>
          <Link
            href={buildAttendeeGateUrl(EXPERIENCE_LIVE_PATH)}
            className="touch-target inline-flex min-h-11 items-center justify-center rounded-full border border-brand-blue/40 bg-brand-blue/10 px-4 font-ui text-[0.58rem] font-bold uppercase tracking-[0.12em] text-brand-blue"
          >
            Sign In
          </Link>
        </div>
      ) : !session.canSend ? (
        <p className="holding-room-page__chat-composer font-body text-xs text-brand-muted">
          You are muted in Fellowship Chat.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="holding-room-page__chat-composer">
          {error ? (
            <p className="mb-1 truncate text-center font-body text-xs text-brand-pink">{error}</p>
          ) : null}
          <label className="sr-only" htmlFor="holding-room-chat-input">
            Join the conversation
          </label>
          <input
            id="holding-room-chat-input"
            type="text"
            enterKeyHint="send"
            inputMode="text"
            autoComplete="off"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Join the conversation..."
            disabled={isSending}
            maxLength={FELLOWSHIP_MAX_CONTENT_LENGTH}
            className="holding-room-page__chat-input font-body"
          />
          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            className="touch-target holding-room-page__chat-send font-ui"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
