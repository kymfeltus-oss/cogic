"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties } from "react";
import ExperienceDashboardGridCard from "@/components/experience/dashboard/ExperienceDashboardGridCard";
import LobbyCountdownTimer from "@/components/lobby/LobbyCountdownTimer";
import {
  AWAKENING_ASSETS,
  AWAKENING_CONCERT_BACKDROP_ART,
  AWAKENING_DASHBOARD_BUTTON_GRID,
  AWAKENING_DASHBOARD_OVERLAY_LAYOUT,
  AWAKENING_DASHBOARD_STORY_TOP_Y,
} from "@/lib/experience/awakening-dashboard-assets";
import type { EventCountdownConfig } from "@/lib/live/countdown-config";
import type { CountdownParts } from "@/lib/live/event-lobby";
import { useLobbyCountdown } from "@/lib/live/useLobbyCountdown";
import { useAttendeeLiveNavTarget } from "@/lib/experience/useAttendeeLiveNavTarget";
import { MOBILE_ARTBOARD_REF, mobileArtboardStageStyle } from "@/lib/responsive";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";

type ExperienceDashboardInterfaceLayerProps = {
  profile: AttendeeProfileSnapshot;
  initialCountdownConfig?: EventCountdownConfig;
  initialCountdown?: CountdownParts;
};

function resolveDashboardWelcomeName(profile: AttendeeProfileSnapshot): string {
  const firstName = profile.firstName?.trim();
  if (firstName) return firstName.toUpperCase();

  const displayName = profile.headerDisplayName?.trim();
  if (displayName) return displayName.split(/\s+/)[0]?.toUpperCase() || "GUEST";

  return "GUEST";
}

export default function ExperienceDashboardInterfaceLayer({
  profile,
  initialCountdownConfig,
  initialCountdown,
}: ExperienceDashboardInterfaceLayerProps) {
  const backgroundRef = useRef<HTMLVideoElement>(null);

  const { config, countdown, eventPhase, isLoading, showTimer } = useLobbyCountdown({
    initialConfig: initialCountdownConfig,
    initialCountdown,
  });
  const { href: liveNavHref } = useAttendeeLiveNavTarget({
    initialConfig: initialCountdownConfig,
  });
  const welcomeName = resolveDashboardWelcomeName(profile);

  useEffect(() => {
    const video = backgroundRef.current;
    if (!video) return;

    video.muted = true;
    video.playsInline = true;
    video.loop = true;

    const tryPlay = () => {
      void video.play().catch(() => {
        /* Autoplay may require a user gesture on some browsers. */
      });
    };

    tryPlay();
    video.addEventListener("loadeddata", tryPlay);

    return () => {
      video.removeEventListener("loadeddata", tryPlay);
      video.pause();
    };
  }, []);

  return (
    <div className="experience-dashboard-container">
      <div
        className="experience-dashboard-artboard"
        style={
          {
            ...mobileArtboardStageStyle({ native: MOBILE_ARTBOARD_REF }),
            "--dash-story-top-y": AWAKENING_DASHBOARD_STORY_TOP_Y,
            "--dash-safe-top": AWAKENING_DASHBOARD_OVERLAY_LAYOUT.safeArea.top,
            "--dash-safe-right": AWAKENING_DASHBOARD_OVERLAY_LAYOUT.safeArea.right,
            "--dash-safe-bottom": AWAKENING_DASHBOARD_OVERLAY_LAYOUT.safeArea.bottom,
            "--dash-safe-left": AWAKENING_DASHBOARD_OVERLAY_LAYOUT.safeArea.left,
            "--dash-overlay-card-gap": AWAKENING_DASHBOARD_OVERLAY_LAYOUT.dashboardCardGap,
            "--dashboard-page-padding": `${AWAKENING_DASHBOARD_OVERLAY_LAYOUT.contentTrackPadding}px`,
            "--dashboard-card-gap": `${AWAKENING_DASHBOARD_OVERLAY_LAYOUT.dashboardCardGap}px`,
            "--dash-dashboard-card-gap": AWAKENING_DASHBOARD_OVERLAY_LAYOUT.dashboardCardGap,
            "--dash-action-cell-padding": AWAKENING_DASHBOARD_OVERLAY_LAYOUT.actionCellPadding,
            "--dash-grid-top-offset": AWAKENING_DASHBOARD_OVERLAY_LAYOUT.gridTopOffset,
            "--dash-artboard-scroll-h": AWAKENING_DASHBOARD_OVERLAY_LAYOUT.artboardScrollHeight,
            "--dash-artboard-h": AWAKENING_DASHBOARD_OVERLAY_LAYOUT.artboardHeight,
            "--dash-artboard-w": AWAKENING_DASHBOARD_OVERLAY_LAYOUT.artboardWidth,
          } as CSSProperties
        }
      >
        <video
          ref={backgroundRef}
          src={AWAKENING_ASSETS.background}
          className="experience-dashboard-artboard__bg"
          width={AWAKENING_CONCERT_BACKDROP_ART.width}
          height={AWAKENING_CONCERT_BACKDROP_ART.height}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
        />

        <div className="experience-dashboard-artboard__overlay">
          {(showTimer || isLoading) && eventPhase === "waiting" ? (
            <div className="experience-dashboard-countdown-slot">
              <LobbyCountdownTimer
                config={config}
                countdown={countdown}
                eventPhase={eventPhase}
                showTimer={showTimer}
                isLoading={isLoading}
                variant="segmented"
              />
            </div>
          ) : null}

          <div className="experience-dashboard-overlay__stack dashboard-page">
            <div className="experience-dashboard-overlay__content-band dashboard-card-stack">
              <Link
                href={AWAKENING_ASSETS.routes.watchStory}
                className="experience-dashboard-overlay__story touch-target"
                aria-label="Watch Ian Craig's healing journey"
              >
                <img
                  src={AWAKENING_ASSETS.ianCraigStoryPoster}
                  alt=""
                  width={1536}
                  height={1024}
                  className="experience-dashboard-overlay__story-img"
                  loading="eager"
                  decoding="async"
                  draggable={false}
                />
                <span
                  className="experience-dashboard-overlay__story-name-mask"
                  aria-label={`Welcome ${welcomeName}`}
                >
                  <span
                    className="experience-dashboard-overlay__story-name"
                    aria-hidden="true"
                  >
                    {welcomeName}
                  </span>
                </span>
              </Link>

              <nav
                className="dashboard-action-grid experience-dashboard-overlay__grid"
                aria-label="Dashboard shortcuts"
              >
                {AWAKENING_DASHBOARD_BUTTON_GRID.map((button) => (
                  <ExperienceDashboardGridCard
                    key={button.id}
                    href={button.id === "live" ? liveNavHref : button.href}
                    src={button.src}
                    ariaLabel={button.ariaLabel}
                  />
                ))}
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
