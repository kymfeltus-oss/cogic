"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertTriangle, Flag, MessageCircle, Pin, RefreshCw, Send, ShieldCheck, UsersRound, X } from "lucide-react";
import { FELLOWSHIP_MAX_CONTENT_LENGTH, type FellowshipChatMessage } from "@/lib/experience/fellowship-chat";
import { useFellowshipChat } from "@/lib/experience/useFellowshipChat";

const REPORT_REASONS = [
  { value: "spam", label: "Spam or misleading" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "safety", label: "Safety concern" },
  { value: "other", label: "Something else" },
] as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase() || "CO";
}

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function SocialPost({
  message,
  currentUserId,
  onReport,
  pinned = false,
}: {
  message: FellowshipChatMessage;
  currentUserId: string | null;
  onReport: (message: FellowshipChatMessage) => void;
  pinned?: boolean;
}) {
  return (
    <article className={`social-post${pinned ? " social-post--pinned" : ""}`}>
      <div className="social-post__identity">
        {message.authorAvatarUrl ? (
          // Attendee avatars are stored in the production profile bucket.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={message.authorAvatarUrl} alt="" loading="lazy" />
        ) : (
          <span aria-hidden="true">{initials(message.author)}</span>
        )}
      </div>
      <div className="social-post__content">
        <header>
          <div>
            <strong>{message.author}</strong>
            <time dateTime={message.createdAt}>{timeLabel(message.createdAt)}</time>
          </div>
          {pinned ? <span className="social-post__pin"><Pin aria-hidden="true" /> Pinned</span> : null}
        </header>
        <p>{message.body}</p>
        {!pinned && currentUserId !== message.userId ? (
          <button type="button" className="social-post__report" onClick={() => onReport(message)}>
            <Flag aria-hidden="true" /> Report
          </button>
        ) : currentUserId === message.userId ? (
          <span className="social-post__you">Your post</span>
        ) : null}
      </div>
    </article>
  );
}

export default function SocialCommunityClient() {
  const chat = useFellowshipChat();
  const [draft, setDraft] = useState("");
  const [reporting, setReporting] = useState<FellowshipChatMessage | null>(null);
  const [reportReason, setReportReason] = useState<(typeof REPORT_REASONS)[number]["value"]>("spam");
  const [reportDetail, setReportDetail] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const remaining = FELLOWSHIP_MAX_CONTENT_LENGTH - draft.length;
  const mutedUntil = useMemo(() => {
    if (!chat.session.mutedUntil) return null;
    return timeLabel(chat.session.mutedUntil);
  }, [chat.session.mutedUntil]);

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || chat.isSending) return;
    setNotice(null);
    const sent = await chat.sendMessage(content);
    if (sent) {
      setDraft("");
      setNotice("Your post is live in the community.");
    }
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reporting || reportBusy) return;
    setReportBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/social/reports", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: reporting.id,
          reason: reportReason,
          detail: reportDetail,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to submit the report.");
      setReporting(null);
      setReportDetail("");
      setNotice("Report submitted privately for owner review.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to submit the report.");
    } finally {
      setReportBusy(false);
    }
  }

  return (
    <main id="main-content" className="cogic-social">
      <section className="cogic-social__hero">
        <div className="cogic-social__hero-icon" aria-hidden="true"><UsersRound /></div>
        <div>
          <p>COGIC community</p>
          <h1>COGIC Social</h1>
          <span>Connect, encourage, and grow together throughout Holy Convocation.</span>
        </div>
        <Link href="/my-convocation">Back to Home</Link>
      </section>

      <div className="cogic-social__layout">
        <section className="social-compose" aria-labelledby="social-compose-title">
          <div className="social-compose__heading">
            <div>
              <p>Community discussion</p>
              <h2 id="social-compose-title">Share with the fellowship</h2>
            </div>
            <ShieldCheck aria-label="Moderated community" />
          </div>

          {!chat.session.postingEnabled ? (
            <div className="social-state social-state--notice" role="status">
              <AlertTriangle aria-hidden="true" />
              <p><strong>Posting is paused.</strong> You can still read community updates while the COGIC team moderates the room.</p>
            </div>
          ) : mutedUntil ? (
            <div className="social-state social-state--notice" role="status">
              <AlertTriangle aria-hidden="true" />
              <p><strong>Posting is temporarily unavailable for your account.</strong> Access returns {mutedUntil}.</p>
            </div>
          ) : (
            <form onSubmit={(event) => void submitPost(event)}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={FELLOWSHIP_MAX_CONTENT_LENGTH}
                placeholder="Share an encouragement, question, or Convocation moment…"
                aria-label="Community post"
                disabled={!chat.session.canSend || chat.isSending}
              />
              <div className="social-compose__actions">
                <span>{remaining} characters remaining</span>
                <button type="submit" disabled={!draft.trim() || !chat.session.canSend || chat.isSending}>
                  <Send aria-hidden="true" /> {chat.isSending ? "Posting…" : "Post"}
                </button>
              </div>
            </form>
          )}
          <p className="social-compose__identity">Posts use your authenticated COGIC attendee profile. Community guidelines and owner moderation apply.</p>
          {notice ? <p className="social-feedback" role="status">{notice}</p> : null}
          {chat.error ? (
            <div className="social-feedback social-feedback--error" role="alert">
              <span>{chat.error}</span>
              <button type="button" onClick={() => void chat.refresh()}><RefreshCw aria-hidden="true" /> Retry</button>
            </div>
          ) : null}
        </section>

        <aside className="social-guidelines">
          <ShieldCheck aria-hidden="true" />
          <h2>Fellowship with care</h2>
          <p>Keep posts respectful, relevant, and safe. Reports are private and reviewed by the COGIC team.</p>
        </aside>

        <section className="social-feed" aria-labelledby="social-feed-title">
          <header className="social-feed__header">
            <div>
              <p>Live community</p>
              <h2 id="social-feed-title">Fellowship feed</h2>
            </div>
            <button type="button" onClick={() => void chat.refresh()} disabled={chat.isLoading} aria-label="Refresh community feed">
              <RefreshCw aria-hidden="true" /> Refresh
            </button>
          </header>

          {chat.isLoading ? (
            <div className="social-feed__loading" role="status" aria-label="Loading community posts">
              <i /><i /><i />
            </div>
          ) : (
            <>
              {chat.pinned ? (
                <SocialPost message={chat.pinned} currentUserId={chat.session.userId} onReport={setReporting} pinned />
              ) : null}
              {chat.messages.length ? (
                <div className="social-feed__posts">
                  {[...chat.messages].reverse().map((message) => (
                    <SocialPost key={message.id} message={message} currentUserId={chat.session.userId} onReport={setReporting} />
                  ))}
                </div>
              ) : !chat.pinned ? (
                <div className="social-feed__empty">
                  <MessageCircle aria-hidden="true" />
                  <h3>The fellowship is ready.</h3>
                  <p>No community posts have been shared yet. Be the first to offer a welcome or encouragement.</p>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      {reporting ? (
        <div className="social-report" role="dialog" aria-modal="true" aria-labelledby="social-report-title">
          <button className="social-report__backdrop" type="button" aria-label="Close report dialog" onClick={() => setReporting(null)} />
          <form onSubmit={(event) => void submitReport(event)}>
            <button type="button" className="social-report__close" aria-label="Close" onClick={() => setReporting(null)}><X /></button>
            <Flag aria-hidden="true" />
            <h2 id="social-report-title">Report this post</h2>
            <p>Reports are private and sent to authorized COGIC moderators.</p>
            <label>
              Reason
              <select value={reportReason} onChange={(event) => setReportReason(event.target.value as typeof reportReason)}>
                {REPORT_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
              </select>
            </label>
            <label>
              Additional details <span>(optional)</span>
              <textarea value={reportDetail} onChange={(event) => setReportDetail(event.target.value)} maxLength={500} />
            </label>
            <button type="submit" disabled={reportBusy}>{reportBusy ? "Submitting…" : "Submit report"}</button>
          </form>
        </div>
      ) : null}
    </main>
  );
}
