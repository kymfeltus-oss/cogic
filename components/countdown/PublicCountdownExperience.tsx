"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import PublicCountdownChatMonitor from "@/components/countdown/PublicCountdownChatMonitor";
import PublicCountdownRings from "@/components/countdown/PublicCountdownRings";
import { usePublicCountdownSchedule } from "@/components/countdown/usePublicCountdownSchedule";
import { useCountdownChatTroubleAlerts } from "@/hooks/useCountdownChatTroubleAlerts";
import {
  COUNTDOWN_STARTING_SHORTLY_LABEL,
  isCountdownStartingShortly,
} from "@/lib/experience/countdown-display";
import { EXPERIENCE_BRAND_ASSETS } from "@/lib/experience/brand-assets";
import type { EventCountdownConfig } from "@/lib/live/countdown-config";
import type { CountdownParts } from "@/lib/live/event-lobby";

export type PublicCountdownMode = "full" | "embed" | "obs";

type PublicCountdownExperienceProps = {
  initialConfig: EventCountdownConfig;
  initialCountdown: CountdownParts;
  mode?: PublicCountdownMode;
};

function formatEventDate(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export default function PublicCountdownExperience({
  initialConfig,
  initialCountdown,
  mode = "full",
}: PublicCountdownExperienceProps) {
  const { config, countdown, eventPhase, hasSchedule } = usePublicCountdownSchedule({
    initialConfig,
    initialCountdown,
  });

  const isEmbed = mode === "embed" || mode === "obs";
  const isObs = mode === "obs";
  const showChatMonitor = true;
  const chatMonitorLayout = isObs ? "ticker" : "sidebar";
  const {
    messages: chatMessages,
    isLoading: chatLoading,
    isConnected: chatConnected,
  } = useCountdownChatTroubleAlerts({ enabled: showChatMonitor });
  const startingShortly = isCountdownStartingShortly(countdown, eventPhase);
  const eventDateLabel = formatEventDate(config.start_time);
  const showRings = eventPhase === "waiting" && !startingShortly && hasSchedule;
  const showFooter = !isObs;
  const showLiveCta = mode === "full" && eventPhase === "live";
  const showWaitingMeta = eventPhase !== "waiting" || startingShortly;

  const statusLabel =
    eventPhase === "live"
      ? config.cta_label_live || "WE ARE LIVE"
      : eventPhase === "ended"
        ? config.outro_status_label || "EVENT COMPLETE"
        : startingShortly
          ? COUNTDOWN_STARTING_SHORTLY_LABEL
          : config.status_label || "WAITING FOR LIVE SIGNAL";

  const headline =
    eventPhase === "live"
      ? "THE AWAKENING IS LIVE"
      : eventPhase === "ended"
        ? config.outro_headline || "THANK YOU FOR JOINING"
        : config.headline || "YOU'RE ALMOST LIVE";

  const subtitle =
    eventPhase === "live"
      ? config.subtitle || "THE EXPERIENCE IS OPEN NOW"
      : eventPhase === "ended"
        ? config.outro_subtitle || "Stay connected for the next gathering."
        : config.subtitle || "THE AWAKENING BEGINS SOON";

  return (
    <main
      className={[
        "public-countdown",
        isEmbed ? "public-countdown--embed" : "",
        isObs ? "public-countdown--obs" : "",
        showChatMonitor && chatMonitorLayout === "sidebar"
          ? "public-countdown--with-chat-sidebar"
          : "",
        showChatMonitor && chatMonitorLayout === "ticker"
          ? "public-countdown--with-chat-monitor"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="public-countdown__aurora" aria-hidden="true">
        <div className="public-countdown__aurora-layer public-countdown__aurora-layer--blue" />
        <div className="public-countdown__aurora-layer public-countdown__aurora-layer--purple" />
        <div className="public-countdown__aurora-layer public-countdown__aurora-layer--pink" />
      </div>

      <div className="public-countdown__grid-noise" aria-hidden="true" />

      {!isObs ? (
        <div className="public-countdown__lockup-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={EXPERIENCE_BRAND_ASSETS.lockup}
            alt="COGIC LIVE"
            width={1536}
            height={1024}
            className="public-countdown__lockup"
            loading="eager"
            decoding="async"
            draggable={false}
          />
        </div>
      ) : null}

      {config.hero_background_url && !isObs && mode === "embed" ? (
        <div className="public-countdown__hero-bg" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={config.hero_background_url} alt="" className="public-countdown__hero-img" />
          <div className="public-countdown__hero-scrim" />
        </div>
      ) : null}

      <div className="public-countdown__content">
        <motion.header
          className="public-countdown__header"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="public-countdown__eyebrow font-ui">{config.eyebrow || "LIVE RECORDING EXPERIENCE"}</p>
          <h1 className="public-countdown__headline font-headline">{headline}</h1>

          {showWaitingMeta && subtitle ? (
            <p className="public-countdown__subtitle font-ui">{subtitle}</p>
          ) : null}

          {showWaitingMeta ? (
            <div
              className={[
                "public-countdown__status-pill font-ui",
                eventPhase === "live" ? "public-countdown__status-pill--live" : "",
                startingShortly ? "public-countdown__status-pill--soon" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="public-countdown__status-dot" aria-hidden="true" />
              {statusLabel}
            </div>
          ) : null}

          {eventDateLabel && eventPhase === "waiting" && !isObs ? (
            <p className="public-countdown__event-date font-body">{eventDateLabel}</p>
          ) : null}
        </motion.header>

        {showRings ? (
          <PublicCountdownRings countdown={countdown} compact={isObs} />
        ) : startingShortly && eventPhase === "waiting" ? (
          <motion.p
            className="public-countdown__starting-soon font-headline"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
          >
            {COUNTDOWN_STARTING_SHORTLY_LABEL}
          </motion.p>
        ) : eventPhase === "live" ? (
          <motion.div
            className="public-countdown__live-burst font-headline"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 240, damping: 18 }}
          >
            LIVE
          </motion.div>
        ) : null}

        {showFooter ? (
          <motion.footer
            className="public-countdown__footer"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
          >
            <p className="public-countdown__helper font-body">
              {eventPhase === "live"
                ? "The broadcast is open — enter with your email to join."
                : config.helper_text || "STAY CLOSE. THE EXPERIENCE WILL OPEN AUTOMATICALLY."}
            </p>

            {showLiveCta || !isEmbed ? (
              <div className="public-countdown__actions">
                {showLiveCta ? (
                  <Link href="/email-gate?next=/live" className="public-countdown__cta font-ui">
                    Enter Live Experience
                  </Link>
                ) : null}
                {!isEmbed ? (
                  <Link href="/countdown/embed" className="public-countdown__cta-secondary font-ui">
                    OBS / Stream Overlay
                  </Link>
                ) : null}
              </div>
            ) : null}
          </motion.footer>
        ) : null}
      </div>

      {showChatMonitor ? (
        <PublicCountdownChatMonitor
          messages={chatMessages}
          isLoading={chatLoading}
          isConnected={chatConnected}
          layout={chatMonitorLayout}
        />
      ) : null}

    </main>
  );
}
