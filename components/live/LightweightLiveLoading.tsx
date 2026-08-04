"use client";

import { Loader2 } from "lucide-react";

export default function LightweightLiveLoading() {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-[#0B090A] text-zinc-400">
      <Loader2 className="h-5 w-5 animate-spin text-[#1E40AF]" aria-hidden="true" />
      <span className="sr-only">Loading live experience</span>
    </main>
  );
}
