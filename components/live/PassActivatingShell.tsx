"use client";

import { Loader2 } from "lucide-react";

type PassActivatingShellProps = {
  attempt: number;
};

export default function PassActivatingShell({ attempt }: PassActivatingShellProps) {
  return (
    <main className="live-access-page relative overflow-hidden pt-safe pb-safe text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,168,255,0.12),transparent_68%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,0,140,0.08),transparent_55%)]" />
      <div className="live-access-page__track relative z-10 animate-pulse text-center [animation-duration:2s]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-brand-blue/50 bg-brand-blue/10 neon-blue-glow">
          <Loader2 className="h-8 w-8 animate-spin text-brand-blue" />
        </div>
        <p className="mt-8 font-ui text-[0.65rem] font-bold uppercase tracking-[0.32em] text-brand-blue">
          Activating Your Pass
        </p>
        <h1 className="mt-4 font-headline text-xl uppercase tracking-widest text-white">
          Securing Your Concert Access
        </h1>
        <p className="mt-4 text-sm text-zinc-400">
          Validating your ticket and preparing your personal live-room credentials...
        </p>
        {attempt > 1 && (
          <p className="mt-3 text-xs text-zinc-500">Verification scan {attempt} of 5</p>
        )}
      </div>
    </main>
  );
}
