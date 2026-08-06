"use client";

import Image from "next/image";
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
const INTRO_FALLBACK_DESTINATION = buildPersonaHubUrl(DEFAULT_ATTENDEE_NEXT);

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
    return context.userId ? DEFAULT_ATTENDEE_NEXT : INTRO_FALLBACK_DESTINATION;
  } catch {
    return INTRO_FALLBACK_DESTINATION;
  }
}

export default function VideoIntroExperience() {
  const musicRef = useRef<HTMLAudioElement>(null);
  const isNavigatingRef = useRef(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const playIntroMusic = useCallback(async () => {
    const audio = musicRef.current;
    if (!audio) return;
    audio.volume = 0.85;
    audio.loop = true;
    try {
      await audio.play();
    } catch {
      // Browser autoplay policy may require the user's Enter gesture.
    }
  }, []);

  useEffect(() => {
    void playIntroMusic();
    const audio = musicRef.current;
    const unlock = () => void playIntroMusic();
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
      audio?.pause();
    };
  }, [playIntroMusic]);

  const handleEnter = useCallback(() => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    void playIntroMusic();
    setIsExiting(true);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    void resolveIntroDestination().then((destination) => {
      const navigate = () => {
        musicRef.current?.pause();
        window.location.assign(destination);
      };
      if (reducedMotion) navigate();
      else window.setTimeout(navigate, EXIT_MS);
    });
  }, [playIntroMusic]);

  return (
    <div
      className={`intro-flash-root fixed inset-0 z-50 h-dvh w-full overflow-hidden bg-brand-black transition-opacity duration-500 ease-out ${isExiting ? "opacity-0" : "opacity-100"}`}
      onPointerDown={() => void playIntroMusic()}
      onTouchStart={() => void playIntroMusic()}
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
          <Image
            src={INTRO_VIDEO_SRC}
            alt="118th Holy Convocation — Enter COGIC LIVE"
            fill
            priority
            sizes="100vw"
            className="intro-flash-artboard__image"
          />
          <div className="intro-flash-overlay">
            <a
              href={INTRO_FALLBACK_DESTINATION}
              onClick={(event) => {
                event.preventDefault();
                handleEnter();
              }}
              aria-label="Enter COGIC LIVE"
              className="intro-flash-enter-hit"
              style={introRectStyle(INTRO_ENTER_PANEL)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
