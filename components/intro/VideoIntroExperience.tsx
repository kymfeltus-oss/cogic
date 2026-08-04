"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AccessContext } from "@/lib/access";
import { fetchAccessContext } from "@/lib/access";
import { buildPersonaHubUrl, DEFAULT_ATTENDEE_NEXT } from "@/lib/auth/routing";
import {
  INTRO_ENTER_PANEL,
  INTRO_MOBILE_ART,
  INTRO_MUSIC_SRC,
  INTRO_VIDEO_ART,
  INTRO_VIDEO_SRC,
} from "@/lib/experience/intro-assets";
import { introRectStyle } from "@/lib/experience/intro-layout-slots";

const EXIT_MS = 520;
const ACCESS_TIMEOUT_MS = 600;

async function resolveIntroDestination(): Promise<string> {
  try {
    const context = await Promise.race<AccessContext>([
      fetchAccessContext(),
      new Promise((resolve) => {
        window.setTimeout(
          () => resolve({ userId: null, email: null, isGuest: false }),
          ACCESS_TIMEOUT_MS,
        );
      }),
    ]);

    return context.userId
      ? DEFAULT_ATTENDEE_NEXT
      : buildPersonaHubUrl(DEFAULT_ATTENDEE_NEXT);
  } catch {
    return buildPersonaHubUrl(DEFAULT_ATTENDEE_NEXT);
  }
}

export default function VideoIntroExperience() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const isNavigatingRef = useRef(false);
  const musicPlayingRef = useRef(false);
  const [isExiting, setIsExiting] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.preload = "auto";

    const tryPlay = () => {
      void video.play().catch(() => {
        /* Autoplay may require user gesture — enter tap will start playback. */
      });
    };

    const onReady = () => {
      setVideoReady(true);
      tryPlay();
    };

    if (video.readyState >= 2) {
      onReady();
    }

    video.addEventListener("loadeddata", onReady);
    video.addEventListener("canplay", onReady);
    video.addEventListener("loadedmetadata", onReady);

    return () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("loadedmetadata", onReady);
    };
  }, []);

  const stopIntroVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  }, []);

  const stopIntroMusic = useCallback(() => {
    const audio = musicRef.current;
    if (!audio) return;
    musicPlayingRef.current = false;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  const playIntroMusic = useCallback(async () => {
    const audio = musicRef.current;
    if (!audio) return;

    audio.volume = 0.85;
    audio.loop = true;

    try {
      if (audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        audio.load();
        await new Promise<void>((resolve, reject) => {
          if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            resolve();
            return;
          }

          const onReady = () => {
            cleanup();
            resolve();
          };

          const onError = () => {
            cleanup();
            reject(new Error("Intro music failed to load."));
          };

          const cleanup = () => {
            audio.removeEventListener("canplaythrough", onReady);
            audio.removeEventListener("error", onError);
          };

          audio.addEventListener("canplaythrough", onReady);
          audio.addEventListener("error", onError);
        });
      }

      if (audio.paused) {
        await audio.play();
        musicPlayingRef.current = true;
      }
    } catch {
      musicPlayingRef.current = false;
      /* Browser autoplay policy — unlocks on first tap. */
    }
  }, []);

  const unlockIntroAudio = useCallback(() => {
    void playIntroMusic();

    const video = videoRef.current;
    if (!video || !video.paused) return;

    void video.play().catch(() => {
      /* Autoplay may require user gesture — enter tap will start playback. */
    });
  }, [playIntroMusic]);

  useEffect(() => {
    void playIntroMusic();

    const unlockOnGesture = () => {
      unlockIntroAudio();
    };

    window.addEventListener("pointerdown", unlockOnGesture, { passive: true });
    window.addEventListener("touchstart", unlockOnGesture, { passive: true });
    window.addEventListener("keydown", unlockOnGesture, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", unlockOnGesture);
      window.removeEventListener("touchstart", unlockOnGesture);
      window.removeEventListener("keydown", unlockOnGesture);
    };
  }, [playIntroMusic, unlockIntroAudio]);

  useEffect(() => {
    return () => {
      stopIntroVideo();
      stopIntroMusic();
    };
  }, [stopIntroVideo, stopIntroMusic]);

  const handleEnter = useCallback(() => {
    if (isNavigatingRef.current) return;

    unlockIntroAudio();

    isNavigatingRef.current = true;

    setIsExiting(true);

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const navigate = (destination: string) => {
      stopIntroMusic();
      stopIntroVideo();

      if (reducedMotion) {
        window.location.assign(destination);
        return;
      }

      window.setTimeout(() => {
        window.location.assign(destination);
      }, EXIT_MS);
    };

    void resolveIntroDestination()
      .then(navigate)
      .catch(() => navigate(buildPersonaHubUrl(DEFAULT_ATTENDEE_NEXT)));
  }, [stopIntroMusic, stopIntroVideo, unlockIntroAudio]);

  return (
    <div
      className={`intro-flash-root fixed inset-0 z-50 h-dvh w-full overflow-hidden bg-brand-black transition-opacity duration-500 ease-out ${
        isExiting ? "opacity-0" : "opacity-100"
      }`}
      onPointerDown={unlockIntroAudio}
      onTouchStart={unlockIntroAudio}
    >
      <audio ref={musicRef} loop preload="auto" className="intro-flash-audio" aria-hidden="true">
        <source src={INTRO_MUSIC_SRC} type="audio/mp4" />
      </audio>

      <div className="intro-flash-ambience intro-flash-ambience--back" aria-hidden="true">
        <div className="intro-flash-vignette" />
      </div>

      <div className="intro-flash-stage">
        <div
          className="intro-flash-artboard"
          style={{
            ["--intro-art-w" as string]: String(INTRO_VIDEO_ART.width),
            ["--intro-art-h" as string]: String(INTRO_VIDEO_ART.height),
            ["--mobile-art-w" as string]: String(INTRO_MOBILE_ART.width),
            ["--mobile-art-h" as string]: String(INTRO_MOBILE_ART.height),
          }}
        >
          <video
            ref={videoRef}
            src={INTRO_VIDEO_SRC}
            className="intro-flash-artboard__video"
            width={INTRO_VIDEO_ART.width}
            height={INTRO_VIDEO_ART.height}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
          />

          {!videoReady ? (
            <div className="intro-flash-video-loading" aria-hidden="true">
              <span className="intro-flash-video-loading-bar" />
            </div>
          ) : null}

          <div className="intro-flash-overlay">
            <button
              type="button"
              onClick={handleEnter}
              aria-label="Let's get awakened — enter experience"
              className="intro-flash-enter-hit"
              style={introRectStyle(INTRO_ENTER_PANEL)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
