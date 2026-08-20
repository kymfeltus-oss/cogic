"use client";

import Image from "next/image";
import type { MouseEvent } from "react";
import { ArrowRight, Users } from "lucide-react";
import { EXPERIENCE_BRAND_ASSETS } from "@/lib/experience/brand-assets";

type EmailGatePersonaPlateProps = {
  attendeeHref: string;
  teamHref: string;
  onAttendeeSelect?: () => void;
};

/** Hard navigate — avoids flaky App Router RSC soft fetches to auth gates. */
function hardNavigate(href: string, event?: MouseEvent<HTMLAnchorElement>) {
  if (event) {
    event.preventDefault();
  }
  window.location.assign(href);
}

export default function EmailGatePersonaPlate({
  attendeeHref,
  teamHref,
  onAttendeeSelect,
}: EmailGatePersonaPlateProps) {
  return (
    <div className="auth-login-page flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto px-0 py-3 pt-safe pb-safe sm:py-6">
      <div className="auth-login-page__glow pointer-events-none" aria-hidden="true" />

      <div className="relative z-[1] w-[var(--mobile-app-track-w)] max-w-[100vw] px-4">
        <header className="mb-4 text-center">
          <div className="relative mx-auto h-[6.75rem] w-full max-w-[17rem] sm:h-[8rem]">
            <Image
              src={EXPERIENCE_BRAND_ASSETS.lockup}
              alt="COGIC LIVE"
              fill
              priority
              sizes="(max-width: 640px) 68vw, 272px"
              className="object-contain"
            />
          </div>
          <p className="auth-login-page__eyebrow mt-2 font-ui text-[0.54rem] font-bold uppercase tracking-[0.2em]">
            Live · Empower · Transform
          </p>
          <h1 className="mt-2 font-headline text-[clamp(1.55rem,6.2vw,2.15rem)] uppercase leading-none tracking-[0.08em] text-white">
            Choose Your Path
          </h1>
          <p className="mx-auto mt-2 max-w-[17rem] font-body text-[0.82rem] leading-snug text-brand-muted">
            Select how you&apos;re joining the COGIC LIVE experience.
          </p>
        </header>

        <div className="glass-panel rounded-[1rem] border border-brand-border p-4 shadow-[0_0_40px_rgba(0,168,255,0.06)] sm:p-5">
          <nav aria-label="Entry path selection">
            <a
              href={attendeeHref}
              onClick={(event) => {
                onAttendeeSelect?.();
                hardNavigate(attendeeHref, event);
              }}
              className="touch-target group flex min-h-[4rem] w-full items-center justify-between gap-3 rounded-xl border border-brand-blue/45 bg-brand-blue/12 px-4 py-3 transition hover:bg-brand-blue/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
            >
              <span className="flex min-w-0 items-center gap-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-brand-blue/35 bg-brand-blue/10 text-brand-blue">
                  <Users className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block font-ui text-[0.68rem] font-bold uppercase tracking-[0.14em] text-white">
                    Attendee
                  </span>
                  <span className="mt-0.5 block font-body text-xs text-brand-muted">
                    Continue to your dashboard
                  </span>
                </span>
              </span>
              <ArrowRight
                className="size-4 shrink-0 text-brand-blue transition group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </a>
          </nav>
        </div>

        <div className="mt-3 flex justify-center">
          <a
            href={teamHref}
            onClick={(event) => hardNavigate(teamHref, event)}
            className="group inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-ui text-[0.62rem] font-bold uppercase tracking-[0.16em] text-white/52 transition hover:border-brand-purple/35 hover:bg-brand-purple/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
            aria-label="Production team login"
          >
            Production
            <ArrowRight
              className="size-3.5 transition group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </a>
        </div>
      </div>
    </div>
  );
}
