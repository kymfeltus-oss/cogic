"use client";

import Link from "next/link";
import { HandHeart } from "lucide-react";

/**
 * In-stream prayer wall intake is not implemented.
 * Route attendees to the real contact surface instead of a dead submit control.
 */
export default function ExperiencePrayerPanel() {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-headline text-lg uppercase tracking-[0.12em] text-white">Prayer</p>
      <p className="font-body text-sm leading-relaxed text-brand-muted">
        In-stream prayer request intake is not available yet. Use Contact to reach the COGIC LIVE
        team, or share encouragement in Fellowship Chat while you watch.
      </p>
      <div className="rounded-xl border border-white/8 bg-[#111111]/80 p-4">
        <HandHeart className="h-7 w-7 exp-text-magenta" strokeWidth={1.5} aria-hidden="true" />
        <p className="mt-3 font-ui text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white">
          Prayer wall not live
        </p>
        <p className="mt-2 font-body text-sm leading-relaxed text-brand-muted">
          There is no fake submit action here. Open Contact to send a real message when support
          email is configured.
        </p>
      </div>
      <Link
        href="/experience/contact-us"
        className="touch-target inline-flex min-h-11 items-center justify-center self-start rounded-full border border-white/20 bg-white/5 px-6 py-2 font-ui text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white transition hover:border-brand-blue/50"
      >
        Open Contact
      </Link>
    </div>
  );
}
