"use client";

import { useEffect } from "react";
import { Heart } from "lucide-react";
import type { FloatingReaction } from "@/hooks/useFloatingReactions";

type FloatingReactionsProps = {
  reactions: FloatingReaction[];
  onSpawn: () => void;
  onExpire: (id: string) => void;
};

export default function FloatingReactions({
  reactions,
  onSpawn,
  onExpire,
}: FloatingReactionsProps) {
  return (
    <>
      <div className="pointer-events-none absolute bottom-[calc(8.5rem+env(safe-area-inset-bottom))] right-3 z-30 flex h-48 w-16 flex-col items-center justify-end">
        {reactions.map((reaction) => (
          <FloatingHeart key={reaction.id} reaction={reaction} onExpire={onExpire} />
        ))}
      </div>

      <button
        type="button"
        onClick={onSpawn}
        className="absolute bottom-[calc(8.5rem+env(safe-area-inset-bottom))] right-3 z-40 touch-target flex h-12 w-12 items-center justify-center rounded-full border border-brand-pink/40 bg-brand-pink/15 text-brand-pink shadow-[0_0_24px_rgba(255,47,175,0.35)] backdrop-blur-md"
        aria-label="Send heart reaction"
      >
        <Heart className="h-5 w-5 fill-brand-pink" />
      </button>
    </>
  );
}

function FloatingHeart({
  reaction,
  onExpire,
}: {
  reaction: FloatingReaction;
  onExpire: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onExpire(reaction.id), 1_800);
    return () => clearTimeout(timer);
  }, [onExpire, reaction.id]);

  return (
    <span
      className="live-heart-float absolute text-2xl text-brand-pink"
      style={{ transform: `translateX(${reaction.xOffset}px)` }}
      aria-hidden="true"
    >
      ❤️
    </span>
  );
}
