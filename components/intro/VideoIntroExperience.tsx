"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  INTRO_ENTER_PANEL,
  INTRO_MOBILE_ART,
  INTRO_VIDEO_ART,
  INTRO_VIDEO_SRC,
} from "@/lib/experience/intro-assets";
import {
  introEnterAnonymousFallback,
  type IntroEnterDestination,
} from "@/lib/experience/intro-destination";
import { introRectStyle } from "@/lib/experience/intro-layout-slots";

const EXIT_MS = 520;
const DESTINATION_TIMEOUT_MS = 2500;
const INTRO_FALLBACK_DESTINATION = introEnterAnonymousFallback();

async function resolveIntroDestination(): Promise<string> {
  try {
    const result = await Promise.race<IntroEnterDestination | null>([
      fetch("/api/intro/destination", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      }).then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as IntroEnterDestination;
      }),
      new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), DESTINATION_TIMEOUT_MS);
      }),
    ]);

    if (result?.destination?.startsWith("/")) {
      return result.destination;
    }
    return INTRO_FALLBACK_DESTINATION;
  } catch {
    return INTRO_FALLBACK_DESTINATION;
  }
}

export default function VideoIntroExperience() {
  const isNavigatingRef = useRef(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleEnter = useCallback(() => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setIsExiting(true);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    void resolveIntroDestination().then((destination) => {
      const navigate = () => {
        window.location.assign(destination);
      };
      if (reducedMotion) navigate();
      else window.setTimeout(navigate, EXIT_MS);
    });
  }, []);

  return (
    <div
      className={`intro-flash-root fixed inset-0 z-50 h-dvh w-full overflow-hidden bg-brand-black transition-opacity duration-500 ease-out ${isExiting ? "opacity-0" : "opacity-100"}`}
    >
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
            sizes="(max-width: 430px) 100vw, 430px"
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
