"use client";

import Image from "next/image";
import {
  COUNTDOWN_STARTING_SHORTLY_LABEL,
  isCountdownStartingShortly,
} from "@/lib/experience/countdown-display";
import type { CountdownParts } from "@/lib/live/event-lobby";
import type { EventCountdownConfig, EventCountdownPhase } from "@/lib/live/countdown-config";
import { EXPERIENCE_BRAND_ASSETS } from "@/lib/experience/brand-assets";
import { cn } from "@/lib/utils";

type LobbyCountdownTimerProps = {
  config: EventCountdownConfig;
  countdown: CountdownParts;
  eventPhase: EventCountdownPhase;
  showTimer: boolean;
  isLoading?: boolean;
  /** Segmented digits (experience hub) vs HH : MM : SS (dashboard lobby). */
  variant?: "segmented" | "hms";
  className?: string;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatCountdownHms(countdown: CountdownParts): string {
  const totalHours = countdown.days * 24 + countdown.hours;
  return `${pad(totalHours)} : ${pad(countdown.minutes)} : ${pad(countdown.seconds)}`;
}

function LobbyCountdownHms({
  config,
  countdown,
  eventPhase,
  showTimer,
}: LobbyCountdownTimerProps) {
  const startingShortly = isCountdownStartingShortly(countdown, eventPhase);
  const timeDisplay =
    eventPhase === "waiting" && showTimer && !countdown.isComplete
      ? formatCountdownHms(countdown)
      : startingShortly
        ? COUNTDOWN_STARTING_SHORTLY_LABEL
        : "00 : 00 : 00";

  return (
    <div className="relative mb-2 h-[108px] w-full max-w-[390px]">
      <Image
        src={config.countdown_frame_url || EXPERIENCE_BRAND_ASSETS.countdownFrame}
        alt=""
        fill
        className="object-contain"
        priority
      />
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
        <p
          className={
            startingShortly
              ? "font-ui text-[0.65rem] font-bold uppercase leading-none tracking-[0.16em] text-brand-blue"
              : "font-headline text-[42px] leading-none tracking-[0.18em] text-white"
          }
          style={
            startingShortly
              ? undefined
              : { textShadow: "0 2px 16px rgba(0,0,0,0.95), 0 0 24px rgba(0,0,0,0.85)" }
          }
          aria-live="polite"
          aria-label={startingShortly ? COUNTDOWN_STARTING_SHORTLY_LABEL : "Event countdown"}
          suppressHydrationWarning
        >
          {timeDisplay}
        </p>
        <div className="mt-[10px] grid w-[250px] grid-cols-3 font-ui text-[10px] font-bold uppercase tracking-[0.28em] text-brand-muted">
          <span>HRS</span>
          <span className="text-center">MINS</span>
          <span className="text-right">SECS</span>
        </div>
      </div>
    </div>
  );
}

function LobbyCountdownSegmented({
  config,
  countdown,
  eventPhase,
  showTimer,
  isLoading = false,
  className,
}: LobbyCountdownTimerProps) {
  if (isLoading) {
    return (
      <p className={cn("font-body text-sm text-brand-muted", className)} aria-live="polite">
        Loading event schedule…
      </p>
    );
  }

  if (eventPhase === "ended" || eventPhase === "live") {
    return null;
  }

  if (!showTimer) {
    return null;
  }

  if (isCountdownStartingShortly(countdown, eventPhase)) {
    return (
      <p
        className={cn(
          "font-ui text-[0.65rem] font-bold uppercase tracking-[0.18em] text-brand-blue",
          className,
        )}
        aria-live="polite"
      >
        {COUNTDOWN_STARTING_SHORTLY_LABEL}
      </p>
    );
  }

  const segments =
    countdown.days > 0
      ? [
          { value: pad(countdown.days), label: "Days" },
          { value: pad(countdown.hours), label: "Hrs" },
          { value: pad(countdown.minutes), label: "Min" },
          { value: pad(countdown.seconds), label: "Sec" },
        ]
      : [
          { value: pad(countdown.hours), label: "Hrs" },
          { value: pad(countdown.minutes), label: "Min" },
          { value: pad(countdown.seconds), label: "Sec" },
        ];

  return (
    <div className={cn("relative mx-auto w-full max-w-[min(100%,24rem)]", className)}>
      <div className="relative aspect-[4.6/1] w-full">
        <Image
          src={config.countdown_frame_url || EXPERIENCE_BRAND_ASSETS.countdownFrame}
          alt=""
          fill
          priority
          sizes="(max-width: 768px) 92vw, 24rem"
          className="object-contain"
        />
        <div
          className="absolute inset-[22%_8%_24%_8%] flex items-center justify-center"
          aria-live="polite"
          aria-label="Event countdown"
        >
          <div
            className={cn(
              "flex w-full items-center justify-center gap-1 sm:gap-2",
              segments.length === 4 ? "px-1" : "px-4",
            )}
          >
            {segments.map((segment, index) => (
              <span key={segment.label} className="flex items-center gap-1 sm:gap-2">
                <span className="flex flex-col items-center">
                  <span
                    className="font-headline text-[clamp(1rem,4.5vw,1.65rem)] tabular-nums leading-none text-white"
                    suppressHydrationWarning
                  >
                    {segment.value}
                  </span>
                  <span className="mt-0.5 hidden font-ui text-[0.42rem] font-bold uppercase tracking-[0.14em] text-brand-muted sm:inline">
                    {segment.label}
                  </span>
                </span>
                {index < segments.length - 1 ? (
                  <span
                    className="font-headline text-[clamp(0.85rem,3.5vw,1.25rem)] tabular-nums text-white/85"
                    aria-hidden="true"
                  >
                    :
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LobbyCountdownTimer(props: LobbyCountdownTimerProps) {
  if (props.variant === "hms") {
    return <LobbyCountdownHms {...props} />;
  }
  return <LobbyCountdownSegmented {...props} />;
}
