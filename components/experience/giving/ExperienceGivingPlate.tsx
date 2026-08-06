"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";
import MobileArtboardTabHeader from "@/components/navigation/MobileArtboardTabHeader";
import type { AttendeeProfileSnapshot } from "@/lib/profile/attendee-profile";
import {
  MOBILE_ARTBOARD_ART_FIT,
  MOBILE_ARTBOARD_TAB_SHELL,
  MOBILE_ARTBOARD_TAB_STAGE,
  mobileArtboardStageStyle,
} from "@/lib/responsive";
import {
  VITAL_SEED_GIVING_ASSETS,
  VITAL_SEED_GIVING_HEADER_STAGE_RATIO,
  VITAL_SEED_GIVING_MOBILE_ART_NATIVE,
} from "@/lib/vital-seed/giving-assets";

type ExperienceGivingPlateProps = {
  profile: AttendeeProfileSnapshot;
  onProfileChange: (profile: AttendeeProfileSnapshot) => void;
  children: ReactNode;
};

export default function ExperienceGivingPlate({
  profile,
  onProfileChange,
  children,
}: ExperienceGivingPlateProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const bgImgRef = useRef<HTMLImageElement>(null);
  const formOverlayRef = useRef<HTMLDivElement>(null);

  const syncFormPlacement = useCallback(() => {
    const stage = stageRef.current;
    const overlay = formOverlayRef.current;
    if (!stage || !overlay) return;

    const stageRect = stage.getBoundingClientRect();
    if (stageRect.height <= 0) return;

    const nativeW = VITAL_SEED_GIVING_MOBILE_ART_NATIVE.width;
    const nativeH = VITAL_SEED_GIVING_MOBILE_ART_NATIVE.height;
    const scale = Math.min(stageRect.width / nativeW, stageRect.height / nativeH);
    const paintedHeightPx = nativeH * scale;
    const paintedBottomPct = (paintedHeightPx / stageRect.height) * 100;
    const desiredTopPct = Math.min(paintedBottomPct + 1, 56);
    const rootStyle = getComputedStyle(document.documentElement);
    const bottomDockHeight = Number.parseFloat(
      rootStyle.getPropertyValue("--bottom-dock-display-h"),
    );
    const dockClearancePx = (Number.isFinite(bottomDockHeight) ? bottomDockHeight : 56) + 24;
    const contentHeightPx =
      overlay.firstElementChild?.getBoundingClientRect().height ?? overlay.scrollHeight;
    const highestSafeTopPct =
      ((stageRect.height - dockClearancePx - contentHeightPx) / stageRect.height) * 100;
    const formTopPct = Math.max(0, Math.min(desiredTopPct, highestSafeTopPct));

    overlay.style.setProperty("--vital-giving-form-top", `${formTopPct}%`);
  }, []);

  useEffect(() => {
    syncFormPlacement();

    const stage = stageRef.current;
    if (!stage) return;

    const observer = new ResizeObserver(() => syncFormPlacement());
    observer.observe(stage);

    window.addEventListener("resize", syncFormPlacement);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncFormPlacement);
    };
  }, [syncFormPlacement]);

  return (
    <div className={`vital-giving-page ${MOBILE_ARTBOARD_TAB_SHELL}`}>
      <div
        ref={stageRef}
        className={`vital-giving-page__stage ${MOBILE_ARTBOARD_TAB_STAGE}`}
        style={
          {
            ...mobileArtboardStageStyle(),
            "--vital-giving-form-top": `${VITAL_SEED_GIVING_HEADER_STAGE_RATIO * 100 + 1}%`,
          } as CSSProperties
        }
      >
        <div className={MOBILE_ARTBOARD_ART_FIT}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={bgImgRef}
            src={VITAL_SEED_GIVING_ASSETS.mobileBackground}
            alt="COGIC Giving"
            width={VITAL_SEED_GIVING_MOBILE_ART_NATIVE.width}
            height={VITAL_SEED_GIVING_MOBILE_ART_NATIVE.height}
            className="vital-giving-page__bg"
            loading="eager"
            decoding="async"
            draggable={false}
            onLoad={syncFormPlacement}
          />

          <MobileArtboardTabHeader
            title="Giving"
            profile={profile}
            onProfileChange={onProfileChange}
          />

          <div ref={formOverlayRef} className="vital-giving-page__form-overlay">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}




