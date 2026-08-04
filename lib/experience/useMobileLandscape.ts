"use client";

import { useEffect, useState } from "react";

/** True on phone-sized viewports in landscape (chat becomes an overlay). */
export function useMobileLandscape(): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px) and (orientation: landscape)");
    const update = () => setMatches(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return matches;
}
