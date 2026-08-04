"use client";

import { Gem, MoreHorizontal, Plus, Share2 } from "lucide-react";
import { formatSowSeedCostLabel } from "@/lib/experience/live-seed-monetization";

type IanCraigLiveMobileDockProps = {
  seedBalance: number;
  seedBalanceLoading?: boolean;
  usedFreeTaps: number;
  isSowing?: boolean;
  shareCopied: boolean;
  onAddSeeds: () => void;
  onSowSeed: () => void;
  onShare: () => void;
  onMore: () => void;
};

/** Compact mobile monetization dock — seed balance, sow, share, more. */
export default function IanCraigLiveMobileDock({
  seedBalance,
  seedBalanceLoading = false,
  usedFreeTaps,
  isSowing = false,
  shareCopied,
  onAddSeeds,
  onSowSeed,
  onShare,
  onMore,
}: IanCraigLiveMobileDockProps) {
  const sowLabel = formatSowSeedCostLabel(usedFreeTaps);

  return (
    <footer className="ian-craig-live-mobile-dock pointer-events-auto absolute inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/72 backdrop-blur-xl">
      <div className="flex items-center gap-2 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-brand-blue/30 bg-brand-blue/10 px-3 py-2">
          <span className="font-ui text-[0.5rem] font-bold uppercase tracking-[0.16em] text-brand-muted">
            Seeds
          </span>
          <span className="min-w-0 truncate font-ui text-sm font-bold tabular-nums text-brand-blue">
            {seedBalanceLoading ? "…" : seedBalance.toLocaleString("en-US")}
          </span>
          <button
            type="button"
            onClick={onAddSeeds}
            className="touch-target ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-blue/35 bg-brand-blue/15 text-brand-blue"
            aria-label="Buy more seeds"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          onClick={onSowSeed}
          disabled={isSowing}
          aria-busy={isSowing}
          className="touch-target flex min-h-10 shrink-0 flex-col items-center justify-center rounded-full border border-brand-pink/35 bg-brand-pink/10 px-3 py-1.5 font-ui text-[0.48rem] font-bold uppercase tracking-[0.1em] text-brand-pink disabled:opacity-50"
        >
          <Gem className="mb-0.5 h-4 w-4" aria-hidden="true" />
          <span>Sow</span>
          <span className="text-[0.42rem] font-semibold normal-case tracking-normal text-brand-muted">
            {sowLabel}
          </span>
        </button>

        <button
          type="button"
          onClick={onShare}
          className="touch-target flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-blue/35 bg-brand-blue/10 text-brand-blue"
          aria-label={shareCopied ? "Link copied" : "Share live stream"}
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onMore}
          className="touch-target flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white"
          aria-label="More actions"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </footer>
  );
}
