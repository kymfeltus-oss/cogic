"use client";

import { useSyncExternalStore } from "react";

/** Matches dashboard.css mobile breakpoint (`max-width: 720px`). */
const DESKTOP_QUERY = "(min-width: 721px)";

function subscribe(onStoreChange: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getSnapshot() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

/** SSR/hydration default: mobile-first (matches approved MobileDashboardHome). */
function getServerSnapshot() {
  return false;
}

/** True when the desktop dashboard composition should mount (not CSS-hidden). */
export function useDesktopDashboard() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
