"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  formatRegistryTimestamp,
  getUpdateTypeLabel,
  UPDATE_REGISTRY_ENTRIES,
  type UpdateEntry,
} from "@/lib/data/updates-registry";
import { getCountdownParts, UPDATES_EVENT_START, type CountdownParts } from "@/lib/countdown";

function CountdownBadge() {
  const [countdown, setCountdown] = useState<CountdownParts>(() =>
    getCountdownParts(UPDATES_EVENT_START),
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown(getCountdownParts(UPDATES_EVENT_START));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 md:justify-start">
      {[
        { value: countdown.days, label: "Days" },
        { value: countdown.hours, label: "Hrs" },
        { value: countdown.minutes, label: "Min" },
        { value: countdown.seconds, label: "Sec" },
      ].map((unit) => (
        <div
          key={unit.label}
          className="min-w-[3.25rem] rounded-xl border border-[#1E40AF]/40 bg-[#1E40AF]/10 px-2 py-2 text-center"
        >
          <p className="text-lg font-bold tabular-nums text-[#1E40AF]">{unit.value}</p>
          <p className="text-[0.45rem] uppercase tracking-wider text-zinc-500">
            {unit.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function UpdateCard({ entry, index }: { entry: UpdateEntry; index: number }) {
  const Icon = entry.icon;
  const isCountdown = entry.type === "countdown";
  const priorityRing =
    entry.priority === "high"
      ? "border-[#B0267A]/50"
      : entry.priority === "medium"
        ? "border-[#1E40AF]/40"
        : "border-white/10";

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`mb-4 break-inside-avoid rounded-2xl border ${priorityRing} bg-[#111111]/80 p-4 shadow-[0_0_20px_rgba(30,64,175,0.08)] md:p-5`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#1E40AF]/30 bg-[#0B090A]">
          <Icon className="h-5 w-5 text-[#1E40AF]" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.55rem] font-bold uppercase tracking-[0.18em] text-[#B0267A]">
            {getUpdateTypeLabel(entry.type)}
          </p>
          <h3 className="mt-1 text-sm font-bold uppercase tracking-[0.1em] text-white">
            {entry.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{entry.body}</p>
          {entry.metric && (
            <p className="mt-3 inline-block rounded-full border border-[#1E40AF]/40 bg-[#1E40AF]/10 px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#1E40AF]">
              {entry.metric}
            </p>
          )}
          {isCountdown && <CountdownBadge />}
          <p className="mt-3 text-[0.6rem] uppercase tracking-[0.12em] text-zinc-500">
            {formatRegistryTimestamp(entry.timestamp)}
          </p>
        </div>
      </div>
    </motion.article>
  );
}

function TimelineRail({ entries }: { entries: readonly UpdateEntry[] }) {
  return (
    <ol className="relative flex flex-col gap-0 pl-6">
      <span
        aria-hidden="true"
        className="absolute top-2 bottom-2 left-[0.45rem] w-px bg-gradient-to-b from-[#1E40AF] via-[#B0267A] to-transparent"
      />
      {entries.map((entry, index) => {
        const Icon = entry.icon;

        return (
          <motion.li
            key={entry.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.06 }}
            className="relative pb-6 last:pb-0"
          >
            <span className="absolute top-1 -left-6 flex h-4 w-4 items-center justify-center rounded-full border border-[#1E40AF] bg-[#0B090A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#B0267A]" />
            </span>
            <article className="rounded-2xl border border-white/10 bg-[#111111]/80 p-4">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-[#1E40AF]" strokeWidth={1.5} />
                <p className="text-[0.55rem] font-bold uppercase tracking-[0.16em] text-zinc-500">
                  {getUpdateTypeLabel(entry.type)}
                </p>
              </div>
              <h3 className="mt-2 text-sm font-bold uppercase tracking-[0.1em] text-white">
                {entry.title}
              </h3>
              <p className="mt-2 text-sm text-zinc-400">{entry.body}</p>
              {entry.type === "countdown" && <CountdownBadge />}
              <p className="mt-3 text-[0.6rem] uppercase tracking-[0.12em] text-zinc-500">
                {formatRegistryTimestamp(entry.timestamp)}
              </p>
            </article>
          </motion.li>
        );
      })}
    </ol>
  );
}

export default function UpdateRegistryFeed() {
  return (
    <>
      {/* Mobile: linear instruction timeline */}
      <div className="md:hidden">
        <TimelineRail entries={UPDATE_REGISTRY_ENTRIES} />
      </div>

      {/* Desktop: multi-card masonry */}
      <div className="hidden columns-1 gap-4 md:block md:columns-2 lg:columns-3">
        {UPDATE_REGISTRY_ENTRIES.map((entry, index) => (
          <UpdateCard key={entry.id} entry={entry} index={index} />
        ))}
      </div>
    </>
  );
}
