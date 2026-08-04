import type { ReactNode } from "react";

/**
 * Live route shell — no document-level asset preloads; playback URLs load via manifest API only.
 */
export default function LiveLayout({ children }: { children: ReactNode }) {
  return children;
}
