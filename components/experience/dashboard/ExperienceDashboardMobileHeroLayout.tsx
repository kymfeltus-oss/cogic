"use client";

import {
  concertCardRowTopFromBackdropMedia,
  concertHeroStackAnchorTopFromBackdropMedia,
  dashboardHeroStackTopPx,
  isDashboardBackdropMediaReady,
  queryDashboardBackdropMedia,
} from "@/lib/experience/dashboard-beam-position";
import { useLayoutEffect, type RefObject } from "react";

type ExperienceDashboardMobileHeroLayoutProps = {
  headlineBlockRef: RefObject<HTMLDivElement | null>;
};

/** Pin hero + card hits to normalized rows on the contain-fit backdrop plate. */
export default function ExperienceDashboardMobileHeroLayout({
  headlineBlockRef,
}: ExperienceDashboardMobileHeroLayoutProps) {
  useLayoutEffect(() => {
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      const block = headlineBlockRef.current;
      const shell = document.querySelector<HTMLElement>('[data-dashboard-shell="mobile"]');
      const media = queryDashboardBackdropMedia();
      if (!block || !shell || !media || !isDashboardBackdropMediaReady(media)) {
        return;
      }

      const heroTopPx = dashboardHeroStackTopPx(concertHeroStackAnchorTopFromBackdropMedia(media));
      const cardRowTopPx = Math.round(concertCardRowTopFromBackdropMedia(media));

      shell.style.setProperty("--dash-backdrop-hero-top", `${heroTopPx}px`);
      shell.style.setProperty("--dash-backdrop-card-row-top", `${cardRowTopPx}px`);

      block.dataset.mobileHeroPlaced = "true";
    };

    const onResize = () => measure();
    window.addEventListener("resize", onResize);

    const media = queryDashboardBackdropMedia();
    const onMediaReady = () => measure();
    media?.addEventListener("loadeddata", onMediaReady);
    media?.addEventListener("loadedmetadata", onMediaReady);

    measure();
    requestAnimationFrame(() => measure());

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      media?.removeEventListener("loadeddata", onMediaReady);
      media?.removeEventListener("loadedmetadata", onMediaReady);
    };
  }, [headlineBlockRef]);

  return null;
}
