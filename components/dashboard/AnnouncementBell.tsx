"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

type UnreadPayload = {
  unreadCount?: number;
  latest?: { id?: string; title?: string; publishedAt?: string | null } | null;
  authenticated?: boolean;
};

export default function AnnouncementBell() {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestTitle, setLatestTitle] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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
        setAuthenticated(data.authenticated === true);
        setUnreadCount(
          data.authenticated && typeof data.unreadCount === "number"
            ? data.unreadCount
            : 0,
        );
        setLatestTitle(data.latest?.title ?? null);
      } catch {
        // No fabricated badge when the endpoint fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div className="cl-topbar__bell-wrap" ref={rootRef}>
      <button
        type="button"
        className="cl-topbar__bell-btn"
        aria-label={
          authenticated && unreadCount > 0
            ? `Announcements, ${unreadCount} unread`
            : "Announcements"
        }
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="sr-only">Open announcements</span>
        <span
          className={`cl-topbar__bell-badge${
            authenticated && unreadCount > 0 ? "" : " cl-topbar__bell-badge--empty"
          }`}
          aria-hidden="true"
        >
          {authenticated && unreadCount > 0
            ? unreadCount > 99
              ? "99+"
              : unreadCount
            : null}
        </span>
      </button>

      {open ? (
        <div id={panelId} className="cl-topbar__bell-panel" role="dialog" aria-label="Announcements">
          <p className="cl-topbar__bell-heading">Announcements</p>
          {latestTitle ? (
            <p className="cl-topbar__bell-latest">{latestTitle}</p>
          ) : (
            <p className="cl-topbar__bell-latest">No published updates yet.</p>
          )}
          {authenticated && unreadCount > 0 ? (
            <p className="cl-topbar__bell-meta">{unreadCount} unread</p>
          ) : null}
          <Link
            href="/updates"
            className="cl-btn cl-btn--primary cl-btn--block"
            onClick={() => setOpen(false)}
          >
            View all
          </Link>
        </div>
      ) : null}
    </div>
  );
}
