"use client";

import { BadgeCheck, MoreHorizontal, X } from "lucide-react";

type LiveHeaderProps = {
  hostName: string;
  hostInitials: string;
  viewerCount: number;
  onMore: () => void;
  onClose: () => void;
};

export default function LiveHeader({
  hostName,
  hostInitials,
  viewerCount,
  onMore,
  onClose,
}: LiveHeaderProps) {
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue via-brand-purple to-brand-pink font-ui text-sm font-bold text-white ring-2 ring-white/20">
          {hostInitials}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-ui text-sm font-semibold text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.65)]">
              {hostName}
            </p>
            <BadgeCheck className="h-4 w-4 shrink-0 text-brand-blue" aria-label="Verified host" />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 font-ui text-[0.58rem] font-bold uppercase tracking-wider text-white shadow-[0_0_16px_rgba(239,68,68,0.55)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" />
              Live
            </span>
            <span className="rounded-full bg-black/45 px-2.5 py-0.5 font-ui text-[0.58rem] font-semibold text-white backdrop-blur-sm [text-shadow:0_1px_6px_rgba(0,0,0,0.55)]">
              👁️ {viewerCount.toLocaleString("en-US")}
            </span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onMore}
          className="touch-target flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-md"
          aria-label="More actions"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="touch-target flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-md"
          aria-label="Close live stream"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
