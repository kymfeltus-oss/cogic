"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";

type UnreadPayload = {
  unreadCount?: number;
  latest?: { title?: string; publishedAt?: string | null } | null;
  authenticated?: boolean;
};

export default function AnnouncementsCard() {
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [latestTitle, setLatestTitle] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/announcements/unread", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as UnreadPayload;
        if (cancelled) return;
        if (typeof data.unreadCount === "number") {
          setUnreadCount(data.authenticated ? data.unreadCount : null);
        }
        setLatestTitle(data.latest?.title ?? null);
      } catch {
        // Keep truthful empty/default copy when unread endpoint is unavailable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const body =
    latestTitle != null
      ? latestTitle
      : unreadCount === 0
        ? "No new updates"
        : "Latest updates";

  return (
    <article className="cl-feature-card cl-feature-card--default">
      <p className="cl-feature-card__eyebrow">Announcements</p>
      <div className="cl-feature-card__icon">
        <Megaphone aria-hidden="true" />
      </div>
      <h3>Announcements</h3>
      <p className="cl-feature-card__body">
        {body}
        {typeof unreadCount === "number" && unreadCount > 0 ? (
          <>
            <br />
            <span className="text-white/90">
              {unreadCount} unread
            </span>
          </>
        ) : null}
      </p>
      <Link href="/updates" className="cl-btn cl-btn--primary cl-btn--block">
        View updates
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
      <Link href="/updates" className="cl-btn cl-btn--ghost cl-btn--block">
        Open /updates
      </Link>
    </article>
  );
}
