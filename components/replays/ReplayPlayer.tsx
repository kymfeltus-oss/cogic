"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";

export default function ReplayPlayer({ recordingId, playbackUrl, title }: { recordingId: string; playbackUrl: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSentAt = useRef(0);
  const resumePosition = useRef<number | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/replays/progress?recordingId=${encodeURIComponent(recordingId)}`).then((response) => response.ok ? response.json() : null),
      fetch(`/api/replays/favorites?recordingId=${encodeURIComponent(recordingId)}`).then((response) => response.ok ? response.json() : null),
    ]).then(([progress, favorite]) => {
      if (cancelled) return;
      setAuthenticated(Boolean(progress?.authenticated || favorite?.authenticated));
      setSaved(Boolean(favorite?.saved));
      const position = Number(progress?.progress?.last_position_seconds);
      if (Number.isFinite(position) && position > 5) {
        resumePosition.current = position;
        if (videoRef.current?.readyState && videoRef.current.readyState >= 1) {
          videoRef.current.currentTime = position;
        }
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [recordingId]);

  async function saveProgress(completed = false) {
    const video = videoRef.current;
    if (!video || !authenticated) return;
    await fetch("/api/replays/progress", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordingId, positionSeconds: video.currentTime, durationSeconds: Number.isFinite(video.duration) ? video.duration : undefined, completed }),
    }).catch(() => undefined);
  }

  async function toggleFavorite() {
    if (!authenticated) return;
    const response = await fetch(`/api/replays/favorites${saved ? `?recordingId=${encodeURIComponent(recordingId)}` : ""}`, {
      method: saved ? "DELETE" : "POST",
      headers: saved ? undefined : { "Content-Type": "application/json" },
      body: saved ? undefined : JSON.stringify({ recordingId }),
    }).catch(() => null);
    if (response?.ok) setSaved(!saved);
  }

  return (
    <div>
      <video ref={videoRef} className="aspect-video size-full bg-black" controls playsInline preload="metadata" src={playbackUrl} aria-label={title}
        onLoadedMetadata={() => { if (resumePosition.current !== null && videoRef.current) videoRef.current.currentTime = resumePosition.current; }}
        onTimeUpdate={() => { if (Date.now() - lastSentAt.current > 10000) { lastSentAt.current = Date.now(); void saveProgress(); } }}
        onPause={() => void saveProgress()} onEnded={() => void saveProgress(true)} />
      {authenticated ? (
        <button type="button" onClick={toggleFavorite} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 px-4 py-2 font-ui text-xs font-bold text-white">
          {saved ? <BookmarkCheck className="size-4 text-brand-blue" aria-hidden="true" /> : <Bookmark className="size-4" aria-hidden="true" />}
          {saved ? "Saved" : "Save replay"}
        </button>
      ) : null}
    </div>
  );
}
