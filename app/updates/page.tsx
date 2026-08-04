"use client";

import UpdateRegistryFeed from "@/components/updates/UpdateRegistryFeed";

export default function UpdatesPage() {
  return (
    <main className="min-h-dvh w-full bg-[#0B090A] pt-safe pb-safe text-white">
      <div className="w-full px-4 py-6 md:px-6 lg:px-8">
        <header className="border-b border-white/10 pb-6">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#1E40AF]">
            Global Update Registry
          </p>
          <h1 className="mt-2 text-xl font-bold uppercase tracking-widest md:text-2xl">
            Event Updates
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Push communications, countdown events, and hub alert metrics —
            organized as a guided timeline on mobile and a masonry card grid on
            larger screens.
          </p>
        </header>

        <section className="mt-6 w-full">
          <UpdateRegistryFeed />
        </section>
      </div>
    </main>
  );
}
