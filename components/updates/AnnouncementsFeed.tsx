"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BellOff, Pin } from "lucide-react";
import type { Announcement } from "@/lib/announcements/types";

function priorityLabel(priority: Announcement["priority"]): string {
  if (priority === "urgent") return "Urgent";
  if (priority === "important") return "Important";
  return "Normal";
}

function priorityClass(priority: Announcement["priority"]): string {
  if (priority === "urgent") {
    return "border-red-400/45 bg-red-950/35";
  }
  if (priority === "important") {
    return "border-[#C9A227]/45 bg-[#2a220c]/70";
  }
  return "border-[rgba(75,49,116,0.52)] bg-[rgba(16,10,30,0.88)]";
}

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function AnnouncementsFeed() {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/announcements", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Unable to load announcements.");
      const data = (await response.json()) as { announcements?: Announcement[] };
      setItems(data.announcements ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load announcements.");
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    try {
      await fetch(`/api/announcements/${id}/read`, {
        method: "POST",
        credentials: "include",
      });
      setItems((current) =>
        (current ?? []).map((item) =>
          item.id === id ? { ...item, read: true } : item,
        ),
      );
    } catch {
      // Read state is best-effort for anonymous; authenticated failures stay silent in UI.
    }
  }

  async function markAllRead() {
    setMarking(true);
    try {
      const response = await fetch("/api/announcements/read-all", {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        setItems((current) =>
          (current ?? []).map((item) => ({ ...item, read: true })),
        );
      }
    } finally {
      setMarking(false);
    }
  }

  if (items === null) {
    return (
      <p className="rounded-2xl border border-white/10 bg-[#111111]/80 px-5 py-8 text-center text-sm text-zinc-400" role="status">
        Loading updates…
      </p>
    );
  }

  if (error) {
    return (
      <p className="rounded-2xl border border-red-400/30 bg-red-950/30 px-5 py-8 text-center text-sm text-red-100" role="alert">
        {error}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <section
        className="rounded-2xl border border-white/10 bg-[#111111]/80 px-5 py-10 text-center"
        aria-labelledby="updates-empty-heading"
      >
        <BellOff className="mx-auto h-10 w-10 text-zinc-500" aria-hidden="true" />
        <h2
          id="updates-empty-heading"
          className="mt-4 text-sm font-bold uppercase tracking-[0.16em] text-white"
        >
          No updates published
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
          Official COGIC LIVE announcements will appear here when the production team
          publishes them. There are no demo or sample updates.
        </p>
      </section>
    );
  }

  const unreadCount = items.filter((item) => item.read !== true).length;

  return (
    <div className="space-y-4">
      {unreadCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-300">
            <span className="sr-only">Unread count:</span>
            {unreadCount} unread
          </p>
          <button
            type="button"
            disabled={marking}
            onClick={() => void markAllRead()}
            className="min-h-11 rounded-md border border-white/20 px-4 text-xs font-bold uppercase tracking-[0.12em] text-white disabled:opacity-50"
          >
            Mark all as read
          </button>
        </div>
      ) : null}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <article
              className={`rounded-2xl border px-4 py-4 sm:px-5 ${priorityClass(item.priority)}`}
              aria-labelledby={`announcement-${item.id}-title`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-white/70">
                    <span>{item.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{priorityLabel(item.priority)}</span>
                    {item.pinned ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 text-[#E8D48B]">
                          <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                          Pinned
                        </span>
                      </>
                    ) : null}
                    {item.read !== true ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-white">Unread</span>
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Read</span>
                      </>
                    )}
                  </p>
                  <h2
                    id={`announcement-${item.id}-title`}
                    className="mt-2 text-base font-semibold uppercase tracking-[0.06em] text-white sm:text-lg"
                  >
                    {item.title}
                  </h2>
                  {item.publishedAt ? (
                    <time
                      dateTime={item.publishedAt}
                      className="mt-1 block text-xs text-white/55"
                    >
                      {formatWhen(item.publishedAt)}
                    </time>
                  ) : null}
                </div>
              </div>

              {item.summary ? (
                <p className="mt-3 text-sm font-medium text-white/85">{item.summary}</p>
              ) : null}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/70">
                {item.body}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {item.ctaHref && item.ctaLabel ? (
                  <Link
                    href={item.ctaHref}
                    className="brand-ombre-bg inline-flex min-h-11 items-center justify-center rounded-md px-4 text-xs font-bold uppercase tracking-[0.12em] text-white"
                  >
                    {item.ctaLabel}
                  </Link>
                ) : null}
                {item.read !== true ? (
                  <button
                    type="button"
                    onClick={() => void markRead(item.id)}
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/25 px-4 text-xs font-bold uppercase tracking-[0.12em] text-white"
                  >
                    Mark as read
                  </button>
                ) : null}
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
