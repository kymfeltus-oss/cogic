"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Flag,
  PauseCircle,
  Pin,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  Trash2,
  VolumeX,
} from "lucide-react";

type OwnerPost = {
  id: string;
  userId: string;
  author: string;
  body: string;
  createdAt: string;
  deletedAt: string | null;
  isPinned: boolean;
  likeCount: number;
  amenCount: number;
  mute: { muted_until?: string; reason?: string | null } | null;
};

type OwnerReport = {
  id: string;
  post_id: string;
  reporter_id: string;
  reason: string;
  detail: string | null;
  status: string;
  created_at: string;
  post_body?: string | null;
  postAuthor?: string | null;
  postAuthorId?: string | null;
  postDeletedAt?: string | null;
};

type OwnerPayload = {
  settings?: { postingEnabled: boolean; updatedAt: string | null };
  posts?: OwnerPost[];
  reports?: OwnerReport[];
  error?: string;
};

export default function ConnectModerationClient() {
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [postingEnabled, setPostingEnabled] = useState(true);
  const [posts, setPosts] = useState<OwnerPost[]>([]);
  const [reports, setReports] = useState<OwnerReport[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/owner/social", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await response.json()) as OwnerPayload;
      if (!response.ok) throw new Error(data.error || "Unable to load Connect moderation.");
      setPostingEnabled(data.settings?.postingEnabled !== false);
      setPosts(data.posts ?? []);
      setReports(data.reports ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Connect moderation.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openReports = useMemo(
    () => reports.filter((report) => report.status === "open"),
    [reports],
  );

  async function runAction(
    key: string,
    body: Record<string, unknown>,
    successMessage: string,
  ) {
    setBusyKey(key);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/owner/social", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Moderation action failed.");
      setNotice(successMessage);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Moderation action failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function removeReportedPost(report: OwnerReport) {
    setBusyKey(`remove-${report.id}`);
    setError(null);
    setNotice(null);
    try {
      const removeResponse = await fetch("/api/owner/social", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", postId: report.post_id }),
      });
      const removeData = (await removeResponse.json()) as { error?: string };
      if (!removeResponse.ok) {
        throw new Error(removeData.error || "Unable to remove that post.");
      }

      const resolveResponse = await fetch("/api/owner/social", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve_report", reportId: report.id }),
      });
      const resolveData = (await resolveResponse.json()) as { error?: string };
      if (!resolveResponse.ok) {
        throw new Error(resolveData.error || "Post removed, but report status failed to update.");
      }

      setNotice("Post removed and report resolved.");
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to remove that post.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-3">
      <section className="rounded-[6px] border border-white/10 bg-[#050814]/94 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-ui text-[0.58rem] font-black uppercase tracking-[0.14em] text-[#e9ad32]">
              Community controls
            </p>
            <h2 className="mt-1 font-headline text-xl uppercase tracking-[0.02em]">
              Posting {postingEnabled ? "enabled" : "paused"}
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-white/60">
              Pause Connect when moderation is needed. Attendees can still open the feed, but new
              posts are blocked.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busyKey !== null}
              onClick={() =>
                void runAction(
                  "posting",
                  { action: "set_posting", enabled: !postingEnabled },
                  postingEnabled ? "Community posting paused." : "Community posting enabled.",
                )
              }
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/15 px-3 font-ui text-[0.68rem] uppercase tracking-[0.1em]"
            >
              {postingEnabled ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
              {postingEnabled ? "Pause posting" : "Resume posting"}
            </button>
            <button
              type="button"
              disabled={loading || busyKey !== null}
              onClick={() => void load()}
              className="inline-flex min-h-10 items-center gap-2 rounded-md brand-ombre-bg px-3 font-ui text-[0.68rem] uppercase tracking-[0.1em]"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <Link
              href="/social"
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 px-3 font-ui text-[0.68rem] uppercase tracking-[0.1em]"
            >
              Open Connect
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-md border border-red-400/30 bg-red-950/40 px-3 py-2 text-sm text-red-100" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-md border border-emerald-400/25 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100" role="status">
          {notice}
        </p>
      ) : null}

      <section className="rounded-[6px] border border-white/10 bg-[#050814]/94 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Flag className="h-4 w-4 text-[#fca5a5]" />
          <h2 className="font-headline text-lg uppercase tracking-[0.02em]">
            Moderation queue ({openReports.length})
          </h2>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-white/45">Loading moderation records…</p>
        ) : openReports.length === 0 ? (
          <div className="rounded-md border border-dashed border-white/12 px-4 py-10 text-center text-sm text-white/45">
            Clean queue. No pending items require moderator intervention.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-left text-xs">
              <thead className="border-b border-white/10 text-[0.62rem] uppercase tracking-[0.12em] text-white/50">
                <tr>
                  <th className="px-2 py-3 font-semibold">Flagged content</th>
                  <th className="px-2 py-3 font-semibold">Reason</th>
                  <th className="px-2 py-3 font-semibold">Status</th>
                  <th className="px-2 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {openReports.map((report) => (
                  <tr key={report.id} className="align-top">
                    <td className="px-2 py-3">
                      <p className="max-w-sm font-medium text-white/90">
                        {report.post_body || "Post body unavailable"}
                      </p>
                      <p className="mt-1 text-[0.65rem] text-white/40">
                        {report.postAuthor || "Unknown author"} · report {report.id.slice(0, 8)}
                        {report.postDeletedAt ? " · already removed" : ""}
                      </p>
                    </td>
                    <td className="px-2 py-3">
                      <span className="rounded bg-red-500/15 px-2 py-1 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-red-200">
                        {report.reason}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-white/40">
                      {report.status}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={busyKey !== null || Boolean(report.postDeletedAt)}
                          onClick={() => void removeReportedPost(report)}
                          className="inline-flex min-h-8 items-center gap-1 rounded-md bg-red-700 px-2.5 text-[0.62rem] font-bold uppercase tracking-[0.08em]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete post
                        </button>
                        <button
                          type="button"
                          disabled={busyKey !== null}
                          onClick={() =>
                            void runAction(
                              `dismiss-${report.id}`,
                              { action: "dismiss_report", reportId: report.id },
                              "Report dismissed.",
                            )
                          }
                          className="inline-flex min-h-8 items-center rounded-md border border-white/15 px-2.5 text-[0.62rem] font-bold uppercase tracking-[0.08em]"
                        >
                          Dismiss
                        </button>
                        {report.postAuthorId ? (
                          <button
                            type="button"
                            disabled={busyKey !== null}
                            onClick={() =>
                              void runAction(
                                `mute-${report.id}`,
                                {
                                  action: "mute",
                                  userId: report.postAuthorId,
                                  minutes: 1_440,
                                  reason: `Reported: ${report.reason}`,
                                },
                                "Author muted for 24 hours.",
                              )
                            }
                            className="inline-flex min-h-8 items-center gap-1 rounded-md border border-amber-300/30 px-2.5 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-amber-200"
                          >
                            <VolumeX className="h-3.5 w-3.5" />
                            Mute 24h
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-[6px] border border-white/10 bg-[#050814]/94 p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#e9ad32]" />
          <h2 className="font-headline text-lg uppercase tracking-[0.02em]">Recent posts</h2>
        </div>
        {loading ? (
          <p className="py-8 text-center text-sm text-white/45">Loading posts…</p>
        ) : posts.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/45">No Connect posts yet.</p>
        ) : (
          <div className="space-y-2">
            {posts.slice(0, 40).map((post) => (
              <article
                key={post.id}
                className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-3"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {post.author}
                      {post.isPinned ? (
                        <span className="ml-2 inline-flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.1em] text-[#e9ad32]">
                          <Pin className="h-3 w-3" /> Pinned
                        </span>
                      ) : null}
                      {post.deletedAt ? (
                        <span className="ml-2 text-[0.62rem] uppercase tracking-[0.1em] text-red-300">
                          Removed
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm text-white/75">{post.body}</p>
                    <p className="mt-1 text-[0.65rem] text-white/40">
                      Amen {post.amenCount} · Encourage {post.likeCount}
                      {post.mute?.muted_until
                        ? ` · muted until ${new Date(post.mute.muted_until).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!post.deletedAt ? (
                      <>
                        <button
                          type="button"
                          disabled={busyKey !== null}
                          onClick={() =>
                            void runAction(
                              `pin-${post.id}`,
                              { action: post.isPinned ? "unpin" : "pin", postId: post.id },
                              post.isPinned ? "Post unpinned." : "Post pinned.",
                            )
                          }
                          className="inline-flex min-h-8 items-center gap-1 rounded-md border border-white/15 px-2.5 text-[0.62rem] font-bold uppercase tracking-[0.08em]"
                        >
                          <Pin className="h-3.5 w-3.5" />
                          {post.isPinned ? "Unpin" : "Pin"}
                        </button>
                        <button
                          type="button"
                          disabled={busyKey !== null}
                          onClick={() =>
                            void runAction(
                              `remove-${post.id}`,
                              { action: "remove", postId: post.id },
                              "Post removed.",
                            )
                          }
                          className="inline-flex min-h-8 items-center gap-1 rounded-md bg-red-700/90 px-2.5 text-[0.62rem] font-bold uppercase tracking-[0.08em]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={busyKey !== null}
                        onClick={() =>
                          void runAction(
                            `restore-${post.id}`,
                            { action: "restore", postId: post.id },
                            "Post restored.",
                          )
                        }
                        className="inline-flex min-h-8 items-center rounded-md border border-white/15 px-2.5 text-[0.62rem] font-bold uppercase tracking-[0.08em]"
                      >
                        Restore
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyKey !== null}
                      onClick={() =>
                        void runAction(
                          `mute-post-${post.id}`,
                          {
                            action: post.mute ? "unmute" : "mute",
                            userId: post.userId,
                            minutes: 1_440,
                            reason: "COGIC Connect moderation",
                          },
                          post.mute ? "Author unmuted." : "Author muted for 24 hours.",
                        )
                      }
                      className="inline-flex min-h-8 items-center gap-1 rounded-md border border-amber-300/30 px-2.5 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-amber-200"
                    >
                      <VolumeX className="h-3.5 w-3.5" />
                      {post.mute ? "Unmute" : "Mute 24h"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
