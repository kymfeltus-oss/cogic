"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { AWAKENING_ASSETS } from "@/lib/experience/awakening-dashboard-assets";

/** Ian Craig healing journey — poster now, MP4 when `ianCraigStoryVideo` is wired. */
export default function ExperienceDashboardStorySlot() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoSrc = AWAKENING_ASSETS.ianCraigStoryVideo;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    video.muted = false;
    video.playsInline = true;
    video.controls = true;
    video.preload = "metadata";

    return () => {
      video.pause();
    };
  }, [videoSrc]);

  if (videoSrc) {
    return (
      <div className="experience-dashboard-story-slot">
        <video
          ref={videoRef}
          src={videoSrc}
          poster={AWAKENING_ASSETS.ianCraigStoryPoster}
          className="experience-dashboard-story-slot__media"
          controls
          playsInline
          preload="metadata"
          aria-label="Ian Craig healing journey"
        />
      </div>
    );
  }

  return (
    <Link
      href={AWAKENING_ASSETS.routes.watchStory}
      className="experience-dashboard-story-slot touch-target"
      aria-label="Watch Ian Craig's healing journey"
    >
      <img
        src={AWAKENING_ASSETS.ianCraigStoryPoster}
        alt="The Journey of Ian Craig — Watch Now"
        width={1536}
        height={1024}
        className="experience-dashboard-story-slot__media"
        loading="eager"
        decoding="async"
        draggable={false}
      />
    </Link>
  );
}
