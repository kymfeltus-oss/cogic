"use client";

import type { ReactNode } from "react";
import {
  Gem,
  HandHeart,
  MoreHorizontal,
  Plus,
  Share2,
} from "lucide-react";
import { formatLiveElapsed } from "@/lib/experience/useLiveElapsedTimer";
import type { IanCraigTopSupporter } from "@/components/experience/live/pov/ian-craig/ian-craig-live-types";

type IanCraigLiveDashboardProps = {
  elapsedSeconds: number;
  seedBalance: number;
  seedBalanceLoading?: boolean;
  seedBalanceError?: string | null;
  topSupporter: IanCraigTopSupporter;
  viewerCount: number;
  shareCopied: boolean;
  layout: "overlay" | "sidebar";
  onAddSeeds: () => void;
  onSowSeed: () => void;
  onPray: () => void;
  onShare: () => void;
  onMore: () => void;
};

export default function IanCraigLiveDashboard({
  elapsedSeconds,
  seedBalance,
  seedBalanceLoading = false,
  seedBalanceError = null,
  topSupporter,
  viewerCount,
  shareCopied,
  layout,
  onAddSeeds,
  onSowSeed,
  onPray,
  onShare,
  onMore,
}: IanCraigLiveDashboardProps) {
  const footerClass =
    layout === "overlay"
      ? "absolute inset-x-[clamp(0.75rem,3vw,1.25rem)] bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 lg:hidden"
      : "shrink-0 pt-3";

  return (
    <footer className={footerClass}>
      <div className="rounded-3xl border border-white/10 bg-black/55 p-[clamp(0.75rem,2.5vw,1rem)] backdrop-blur-xl">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <StatBlock label="Live Now" value={formatLiveElapsed(elapsedSeconds)} accent="text-brand-pink" />
          <StatBlock
            label="Seed Balance"
            value={seedBalanceLoading ? "…" : String(seedBalance)}
            accent="text-brand-blue"
            action={
              <button
                type="button"
                onClick={onAddSeeds}
                className="touch-target flex h-7 w-7 items-center justify-center rounded-full border border-brand-blue/30 bg-brand-blue/10 text-brand-blue"
                aria-label="Add seeds to wallet"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            }
          />
          <StatBlock
            label="Top Supporter"
            value={
              <span className="inline-flex items-center gap-1.5 truncate">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-purple/20 font-ui text-[0.55rem] font-bold text-brand-purple ring-1 ring-brand-purple/30">
                  {topSupporter.initials}
                </span>
                <span className="truncate">{topSupporter.name}</span>
                <span className="text-brand-purple">{topSupporter.amount}</span>
              </span>
            }
            accent="text-white"
          />
          <StatBlock
            label="Viewers"
            value={viewerCount.toLocaleString("en-US")}
            accent="text-brand-blue"
          />
        </div>

        {seedBalanceError ? (
          <p className="mt-2 font-body text-[0.65rem] text-brand-pink" role="status">
            {seedBalanceError}
          </p>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ActionButton icon={Gem} label="Sow a Seed" onClick={onSowSeed} accent="pink" />
          <ActionButton icon={HandHeart} label="Pray" onClick={onPray} accent="purple" />
          <ActionButton
            icon={Share2}
            label={shareCopied ? "Copied!" : "Share"}
            onClick={onShare}
            accent="blue"
          />
          <ActionButton icon={MoreHorizontal} label="More" onClick={onMore} accent="blue" />
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
  value: ReactNode;
  accent?: string;
  action?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/8 bg-white/5 px-3 py-2">
      <p className="font-ui text-[0.52rem] font-bold uppercase tracking-[0.18em] text-brand-muted">
        {label}
      </p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className={`min-w-0 truncate font-ui text-sm font-semibold ${accent}`}>{value}</div>
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
  icon: typeof Gem;
  label: string;
  onClick: () => void;
  accent: "pink" | "purple" | "blue";
}) {
  const accentClass =
    accent === "pink"
      ? "border-brand-pink/35 bg-brand-pink/10 text-brand-pink"
      : accent === "purple"
        ? "border-brand-purple/35 bg-brand-purple/10 text-brand-purple"
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

export function IanCraigLiveDashboardSidebar(props: Omit<IanCraigLiveDashboardProps, "layout">) {
  return <IanCraigLiveDashboard {...props} layout="sidebar" />;
}
