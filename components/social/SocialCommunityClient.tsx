"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Flag,
  HandHeart,
  Heart,
  ImagePlus,
  MessageCircle,
  MessageSquareText,
  Pin,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import DMOverlayPopup from "@/components/social/DMOverlayPopup";
import {
  CONNECT_MAX_BODY_LENGTH,
  CONNECT_MAX_MEDIA,
  type ConnectMediaInput,
  type ConnectPost,
} from "@/lib/social/connect-types";
import { useConnectFeed } from "@/lib/social/useConnectFeed";

const REPORT_REASONS = [
  { value: "spam", label: "Spam or misleading" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "safety", label: "Safety concern" },
  { value: "other", label: "Something else" },
] as const;

type LocalPreview = {
  id: string;
  file: File;
  previewUrl: string;
  uploaded?: ConnectMediaInput;
};

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "CO"
  );
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
  post,
  currentUserId,
  onReport,
  onMessage,
  onReact,
  pinned = false,
}: {
  post: ConnectPost;
  currentUserId: string | null;
  onReport: (post: ConnectPost) => void;
  onMessage: (authorId: string) => void;
  onReact: (postId: string, type: "amen" | "like") => void;
  pinned?: boolean;
}) {
  return (
    <article className={`social-post${pinned ? " social-post--pinned" : ""}`}>
      <div className="social-post__identity">
        {post.authorAvatarUrl ? (
          // Attendee avatars are stored in the production profile bucket.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.authorAvatarUrl} alt="" loading="lazy" />
        ) : (
          <span aria-hidden="true">{initials(post.authorName)}</span>
        )}
      </div>
      <div className="social-post__content">
        <header>
          <div>
            <strong>{post.authorName}</strong>
            <time dateTime={post.createdAt}>{timeLabel(post.createdAt)}</time>
          </div>
          {pinned ? (
            <span className="social-post__pin">
              <Pin aria-hidden="true" /> Pinned
            </span>
          ) : null}
        </header>
        <p>{post.body}</p>
        {post.media?.length ? (
          <div className={`social-post__media social-post__media--${Math.min(post.media.length, 4)}`}>
            {post.media.map((item) =>
              item.mediaType === "video" ? (
                <video key={item.id || item.publicUrl} src={item.publicUrl} controls playsInline preload="metadata" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={item.id || item.publicUrl} src={item.publicUrl} alt="" loading="lazy" />
              ),
            )}
          </div>
        ) : null}
        <div className="social-post__react">
          <button
            type="button"
            className={`social-post__react-btn${post.viewerAmened ? " is-active" : ""}`}
            disabled={!currentUserId}
            onClick={() => onReact(post.id, "amen")}
          >
            <HandHeart aria-hidden="true" />
            <span>Amen</span>
            <strong>{post.amenCount || 0}</strong>
          </button>
          <button
            type="button"
            className={`social-post__react-btn${post.viewerLiked ? " is-active is-like" : ""}`}
            disabled={!currentUserId}
            onClick={() => onReact(post.id, "like")}
          >
            <Heart aria-hidden="true" />
            <span>Encourage</span>
            <strong>{post.likeCount || 0}</strong>
          </button>
        </div>
        <div className="social-post__actions">
          {!pinned && currentUserId && currentUserId !== post.authorId ? (
            <>
              <button type="button" className="social-post__report" onClick={() => onReport(post)}>
                <Flag aria-hidden="true" /> Report
              </button>
              <button
                type="button"
                className="social-post__message"
                onClick={() => onMessage(post.authorId)}
              >
                <MessageSquareText aria-hidden="true" /> Message
              </button>
            </>
          ) : currentUserId === post.authorId ? (
            <span className="social-post__you">Your post</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function SocialCommunityClient() {
  const feed = useConnectFeed();
  const [draft, setDraft] = useState("");
  const [previews, setPreviews] = useState<LocalPreview[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [reporting, setReporting] = useState<ConnectPost | null>(null);
  const [reportReason, setReportReason] = useState<(typeof REPORT_REASONS)[number]["value"]>("spam");
  const [reportDetail, setReportDetail] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isDMOpen, setIsDMOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);

  const remaining = CONNECT_MAX_BODY_LENGTH - draft.length;
  const mutedUntil = useMemo(() => {
    if (!feed.session.mutedUntil) return null;
    return timeLabel(feed.session.mutedUntil);
  }, [feed.session.mutedUntil]);

  function clearPreviews() {
    setPreviews((current) => {
      for (const item of current) URL.revokeObjectURL(item.previewUrl);
      return [];
    });
  }

  function onPickMedia(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    setPreviews((current) => {
      const next = [...current];
      for (const file of files) {
        if (next.length >= CONNECT_MAX_MEDIA) break;
        next.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }
      return next;
    });
  }

  function removePreview(id: string) {
    setPreviews((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }

  async function ensureUploadedMedia(): Promise<ConnectMediaInput[] | null> {
    if (!previews.length) return [];
    const already = previews.filter((item) => item.uploaded).map((item) => item.uploaded!);
    const pending = previews.filter((item) => !item.uploaded);
    if (!pending.length) return already;

    setUploadingMedia(true);
    try {
      const formData = new FormData();
      for (const item of pending) formData.append("files", item.file);
      const response = await fetch("/api/social/media", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = (await response.json()) as { items?: ConnectMediaInput[]; error?: string };
      if (!response.ok || !data.items?.length) {
        throw new Error(data.error || "Unable to upload media.");
      }

      let index = 0;
      setPreviews((current) =>
        current.map((item) => {
          if (item.uploaded) return item;
          const uploaded = data.items![index++];
          return uploaded ? { ...item, uploaded } : item;
        }),
      );
      return [...already, ...data.items];
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to upload media.");
      return null;
    } finally {
      setUploadingMedia(false);
    }
  }

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || feed.isSending || uploadingMedia) return;
    setNotice(null);
    const mediaItems = await ensureUploadedMedia();
    if (mediaItems === null) return;

    const sent = await feed.sendPost(content, mediaItems);
    if (sent) {
      setDraft("");
      clearPreviews();
      setNotice("Your post is live in COGIC Connect.");
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
          postId: reporting.id,
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

  function openMessages(authorId: string | null = null) {
    setSelectedRecipient(authorId);
    setIsDMOpen(true);
  }

  return (
    <main id="main-content" className="cogic-social">
      <section className="cogic-social__hero">
        <div>
          <p>COGIC community</p>
          <h1>COGIC Connect</h1>
          <span>Share encouragement and stay connected throughout Holy Convocation.</span>
        </div>
        <Link href="/my-convocation">Back to Home</Link>
      </section>

      <div className="cogic-social__layout cogic-social__layout--single">
        <section className="social-compose" aria-labelledby="social-compose-title">
          <div className="social-compose__heading">
            <div>
              <p>Community discussion</p>
              <h2 id="social-compose-title">Share with the fellowship</h2>
            </div>
            <ShieldCheck aria-label="Moderated community" />
          </div>

          {!feed.session.postingEnabled ? (
            <div className="social-state social-state--notice" role="status">
              <AlertTriangle aria-hidden="true" />
              <p>
                <strong>Posting is paused.</strong> You can still read community updates while the
                COGIC team moderates the room.
              </p>
            </div>
          ) : mutedUntil ? (
            <div className="social-state social-state--notice" role="status">
              <AlertTriangle aria-hidden="true" />
              <p>
                <strong>Posting is temporarily unavailable for your account.</strong> Access returns{" "}
                {mutedUntil}.
              </p>
            </div>
          ) : (
            <form onSubmit={(event) => void submitPost(event)}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={CONNECT_MAX_BODY_LENGTH}
                placeholder="Share an encouragement, question, or Convocation moment…"
                aria-label="Community post"
                disabled={!feed.session.canSend || feed.isSending || uploadingMedia}
              />
              {previews.length ? (
                <div className="social-compose__previews">
                  {previews.map((item) => (
                    <div key={item.id} className="social-compose__preview">
                      {item.file.type.startsWith("video/") ? (
                        <video src={item.previewUrl} muted playsInline />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.previewUrl} alt="" />
                      )}
                      <button
                        type="button"
                        aria-label="Remove attachment"
                        onClick={() => removePreview(item.id)}
                      >
                        <X aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="social-compose__actions">
                <div className="social-compose__media-tools">
                  <label className="social-compose__attach">
                    <ImagePlus aria-hidden="true" />
                    Add media
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                      multiple
                      hidden
                      disabled={
                        !feed.session.canSend ||
                        previews.length >= CONNECT_MAX_MEDIA ||
                        feed.isSending ||
                        uploadingMedia
                      }
                      onChange={onPickMedia}
                    />
                  </label>
                  <span>
                    {remaining} characters · {previews.length}/{CONNECT_MAX_MEDIA} media
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={
                    !draft.trim() || !feed.session.canSend || feed.isSending || uploadingMedia
                  }
                >
                  <Send aria-hidden="true" />{" "}
                  {uploadingMedia ? "Uploading…" : feed.isSending ? "Posting…" : "Post"}
                </button>
              </div>
            </form>
          )}
          <p className="social-compose__identity">
            Posts use your authenticated COGIC profile. Community guidelines and owner moderation
            apply.
          </p>
          {notice ? (
            <p className="social-feedback" role="status">
              {notice}
            </p>
          ) : null}
          {feed.error ? (
            <div className="social-feedback social-feedback--error" role="alert">
              <span>{feed.error}</span>
              <button type="button" onClick={() => void feed.refresh()}>
                <RefreshCw aria-hidden="true" /> Retry
              </button>
            </div>
          ) : null}
        </section>

        <section className="social-feed" aria-labelledby="social-feed-title">
          <header className="social-feed__header">
            <div>
              <p>Live community</p>
              <h2 id="social-feed-title">Connect feed</h2>
            </div>
            <button
              type="button"
              onClick={() => void feed.refresh()}
              disabled={feed.isLoading}
              aria-label="Refresh community feed"
            >
              <RefreshCw aria-hidden="true" /> Refresh
            </button>
          </header>

          {feed.isLoading ? (
            <div className="social-feed__loading" role="status" aria-label="Loading community posts">
              <i />
              <i />
              <i />
            </div>
          ) : (
            <>
              {feed.pinned ? (
                <SocialPost
                  post={feed.pinned}
                  currentUserId={feed.session.userId}
                  onReport={setReporting}
                  onMessage={openMessages}
                  onReact={(postId, type) => void feed.reactToPost(postId, type)}
                  pinned
                />
              ) : null}
              {feed.posts.length ? (
                <div className="social-feed__posts">
                  {feed.posts.map((post) => (
                    <SocialPost
                      key={post.id}
                      post={post}
                      currentUserId={feed.session.userId}
                      onReport={setReporting}
                      onMessage={openMessages}
                      onReact={(postId, type) => void feed.reactToPost(postId, type)}
                    />
                  ))}
                </div>
              ) : !feed.pinned ? (
                <div className="social-feed__empty">
                  <MessageCircle aria-hidden="true" />
                  <h3>The fellowship is ready.</h3>
                  <p>
                    No community posts have been shared yet. Be the first to offer a welcome or
                    encouragement.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      <button
        type="button"
        className="social-dm-fab"
        onClick={() => openMessages(null)}
        aria-label="Open messages"
      >
        <MessageSquareText aria-hidden="true" />
        Messages
      </button>

      {isDMOpen ? (
        <DMOverlayPopup
          currentUserId={feed.session.userId}
          initialRecipientId={selectedRecipient}
          onClose={() => setIsDMOpen(false)}
        />
      ) : null}

      {reporting ? (
        <div className="social-report" role="dialog" aria-modal="true" aria-labelledby="social-report-title">
          <button
            className="social-report__backdrop"
            type="button"
            aria-label="Close report dialog"
            onClick={() => setReporting(null)}
          />
          <form onSubmit={(event) => void submitReport(event)}>
            <button
              type="button"
              className="social-report__close"
              aria-label="Close"
              onClick={() => setReporting(null)}
            >
              <X />
            </button>
            <Flag aria-hidden="true" />
            <h2 id="social-report-title">Report this post</h2>
            <p>Reports are private and sent to authorized COGIC moderators.</p>
            <label>
              Reason
              <select
                value={reportReason}
                onChange={(event) =>
                  setReportReason(event.target.value as typeof reportReason)
                }
              >
                {REPORT_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Additional details <span>(optional)</span>
              <textarea
                value={reportDetail}
                onChange={(event) => setReportDetail(event.target.value)}
                maxLength={500}
              />
            </label>
            <button type="submit" disabled={reportBusy}>
              {reportBusy ? "Submitting…" : "Submit report"}
            </button>
          </form>
        </div>
      ) : null}
    </main>
  );
}
