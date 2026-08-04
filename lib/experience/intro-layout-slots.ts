import type { CSSProperties } from "react";
import type { IntroLayoutRect } from "@/lib/experience/intro-assets";

export function introRectStyle(rect: IntroLayoutRect): CSSProperties {
  return {
    position: "absolute",
    left: `${rect.left}%`,
    top: `${rect.top}%`,
    width: `${rect.width}%`,
    height: `${rect.height}%`,
  };
}
