"use client";

import { BellOff } from "lucide-react";
import { UPDATE_REGISTRY_ENTRIES } from "@/lib/data/updates-registry";

export default function UpdateRegistryFeed() {
  if (UPDATE_REGISTRY_ENTRIES.length === 0) {
    return (
      <section
        className="rounded-2xl border border-white/10 bg-[#111111]/80 px-5 py-10 text-center"
        aria-labelledby="updates-empty-heading"
      >
        <BellOff className="mx-auto h-10 w-10 text-zinc-500" aria-hidden="true" />
        <h2
          id="updates-empty-heading"
          className="mt-4 text-sm font-bold uppercase tracking-[0.16em] text-white"
        >
          No updates published
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
          Official COGIC LIVE announcements will appear here when the production team
          publishes them. There are no demo or sample updates.
        </p>
      </section>
    );
  }

  return null;
}
