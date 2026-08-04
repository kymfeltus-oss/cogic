"use client";

import { motion } from "framer-motion";
import { Crown } from "lucide-react";

export default function ExclusivePage() {
  return (
    <main className="min-h-dvh w-full bg-[#0B090A] pt-safe pb-safe text-white">
      <div className="w-full px-4 py-6 md:px-6 lg:px-8">
        <header className="border-b border-white/10 pb-6">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#1E40AF]">
            Behind The Scenes
          </p>
          <h1 className="mt-2 text-xl font-bold uppercase tracking-widest md:text-2xl">
            Exclusive Content
          </h1>
          <p className="mt-2 text-sm text-zinc-400">Members-only drops and footage</p>
        </header>

        <motion.article
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-10 rounded-2xl border border-[#1E40AF]/40 bg-[#111111]/80 p-8 text-center"
        >
          <Crown className="mx-auto h-12 w-12 text-[#1E40AF]" strokeWidth={1.5} />
          <h2 className="mt-5 text-sm font-bold uppercase tracking-[0.2em] text-white">
            Coming Soon
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Behind the scenes footage, bloopers, and exclusive 300 Awakening content
            drops here first.
          </p>
        </motion.article>
      </div>
    </main>
  );
}
