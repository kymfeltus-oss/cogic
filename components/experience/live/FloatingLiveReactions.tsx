"use client";

import { useLiveStreamReactions } from "@/lib/experience/LiveStreamReactionsContext";

export default function FloatingLiveReactions() {
  const { enabled, floatingReactions } = useLiveStreamReactions();

  if (!enabled || floatingReactions.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[3] overflow-hidden"
    >
      {floatingReactions.map((reaction) => (
        <span
          key={reaction.key}
          className="live-reaction-burst absolute bottom-[14%] text-2xl drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:text-3xl md:text-4xl"
          style={{ left: `${reaction.originX * 100}%`, filter: "saturate(1.05)" }}
        >
          {reaction.emoji}
        </span>
      ))}
    </div>
  );
}
