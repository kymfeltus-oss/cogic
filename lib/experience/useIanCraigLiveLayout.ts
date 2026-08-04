"use client";

import { useEffect, useState } from "react";

export type IanCraigLiveLayoutMode = "mobile" | "tablet-sidebar" | "desktop-split";

function resolveLayoutMode(): IanCraigLiveLayoutMode {
  if (typeof window === "undefined") return "mobile";

  const width = window.innerWidth;
  const landscape = window.matchMedia("(orientation: landscape)").matches;

  if (width >= 1024) return "desktop-split";
  if (width >= 768 && landscape) return "tablet-sidebar";
  return "mobile";
}

/** Responsive layout mode for Ian Craig LIVE — mobile stack, iPad sidebar, laptop split. */
export function useIanCraigLiveLayout(): IanCraigLiveLayoutMode {
  const [mode, setMode] = useState<IanCraigLiveLayoutMode>("mobile");

  useEffect(() => {
    const update = () => setMode(resolveLayoutMode());
    update();

    window.addEventListener("resize", update);
    const landscapeQuery = window.matchMedia("(orientation: landscape)");
    landscapeQuery.addEventListener("change", update);

    return () => {
      window.removeEventListener("resize", update);
      landscapeQuery.removeEventListener("change", update);
    };
  }, []);

  return mode;
}
