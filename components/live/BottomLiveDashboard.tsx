"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus, Share2, Sprout, HeartHandshake } from "lucide-react";
import { formatElapsedTime } from "@/hooks/useLiveStream";
import { buildSeedsHubPath } from "@/lib/live-stream-routes";

type BottomLiveDashboardProps = {
  streamId: string;
  elapsedSeconds: number;
  seedBalance: number;
  topSupporter: { name: string; amount: number };
  viewerCount: number;
  onSowSeed: () => void;
  onPray: () => void;
  onShare: () => void;
  onMore: () => void;
  shareCopied: boolean;
};

export default function BottomLiveDashboard({
  streamId,
  elapsedSeconds,
  seedBalance,
  topSupporter,
  viewerCount,
  onSowSeed,
  onPray,
  onShare,
  onMore,
  shareCopied,
}: BottomLiveDashboardProps) {
  const router = useRouter();

  return (
    <footer className="absolute inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="rounded-3xl border border-white/10 bg-black/55 p-4 backdrop-blur-xl">
        <div className="grid grid-cols-2 gap-3 text-white sm:grid-cols-4">
          <StatBlock label="Live Now" value={formatElapsedTime(elapsedSeconds)} accent="text-brand-pink" />
          <StatBlock
            label="Seed Balance"
            value={String(seedBalance)}
            action={
              <button
                type="button"
                onClick={() => router.push(buildSeedsHubPath(streamId))}
                className="touch-target flex h-7 w-7 items-center justify-center rounded-full border border-brand-blue/30 bg-brand-blue/10 text-brand-blue"
                aria-label="Buy more seeds"
              >
                <Plus className="h-4 w-4" />
              </button>
            }
          />
          <StatBlock
            label="Top Supporter"
            value={`${topSupporter.name} ${topSupporter.amount}`}
            accent="text-brand-purple"
          />
          <StatBlock label="Viewers" value={viewerCount.toLocaleString("en-US")} accent="text-brand-blue" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ActionButton icon={Sprout} label="Sow a Seed" onClick={onSowSeed} accent="pink" />
          <ActionButton icon={HeartHandshake} label="Pray" onClick={onPray} accent="purple" />
          <ActionButton
            icon={Share2}
            label={shareCopied ? "Copied!" : "Share"}
            onClick={onShare}
            accent="blue"
          />
          <ActionButton icon={MoreHorizontal} label="More" onClick={onMore} accent="cyan" />
        </div>
      </div>
    </footer>
  );
}

function StatBlock({
  label,
  value,
  accent = "text-white",
  action,
}: {
  label: string;
  value: string;
  accent?: string;
  action?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/8 bg-white/5 px-3 py-2">
      <p className="font-ui text-[0.52rem] font-bold uppercase tracking-[0.18em] text-brand-muted">
        {label}
      </p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className={`truncate font-ui text-sm font-semibold ${accent}`}>{value}</p>
        {action}
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  accent,
}: {
  icon: typeof Sprout;
  label: string;
  onClick: () => void;
  accent: "pink" | "purple" | "blue" | "cyan";
}) {
  const accentClass =
    accent === "pink"
      ? "border-brand-pink/35 bg-brand-pink/10 text-brand-pink"
      : accent === "purple"
        ? "border-brand-purple/35 bg-brand-purple/10 text-brand-purple"
        : accent === "blue"
          ? "border-brand-blue/35 bg-brand-blue/10 text-brand-blue"
          : "border-brand-blue/35 bg-brand-blue/10 text-brand-blue";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`touch-target flex min-h-11 items-center justify-center gap-2 rounded-full border px-3 py-2 font-ui text-[0.58rem] font-bold uppercase tracking-[0.12em] ${accentClass}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </button>
  );
}
