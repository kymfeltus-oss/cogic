"use client";

import { useEffect, useRef } from "react";
import {
  AWAKENING_ASSETS,
  AWAKENING_CONCERT_BACKDROP_ART,
} from "@/lib/experience/awakening-dashboard-assets";

export default function ExperienceDashboardBackdrop() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
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
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-brand-black"
    >
      <video
        ref={videoRef}
        data-backdrop-variant="mobile"
        src={AWAKENING_ASSETS.background}
        className="experience-dashboard-backdrop-media experience-dashboard-backdrop-media--mobile"
        width={AWAKENING_CONCERT_BACKDROP_ART.width}
        height={AWAKENING_CONCERT_BACKDROP_ART.height}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      />
    </div>
  );
}
