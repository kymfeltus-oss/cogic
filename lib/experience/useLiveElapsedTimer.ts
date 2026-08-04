"use client";

import { useEffect, useState } from "react";

/** Elapsed seconds since the concert start time (0 until show begins). */
export function useLiveElapsedTimer(startIso: string | undefined): number {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!startIso) return;

    const startMs = new Date(startIso).getTime();
    if (Number.isNaN(startMs)) return;

    const tick = () => {
      const diff = Math.floor((Date.now() - startMs) / 1_000);
      setElapsedSeconds(Math.max(0, diff));
    };

    tick();
    const id = window.setInterval(tick, 1_000);
    return () => window.clearInterval(id);
  }, [startIso]);

  return elapsedSeconds;
}

export function formatLiveElapsed(seconds: number): string {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const secs = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}
