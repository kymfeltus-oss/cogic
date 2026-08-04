import type { CSSProperties } from "react";
import type { AuthLayoutRect } from "@/lib/experience/awakening-auth-assets";

export function authRectStyle(rect: AuthLayoutRect): CSSProperties {
  return {
    position: "absolute",
    left: `${rect.left}%`,
    top: `${rect.top}%`,
    width: `${rect.width}%`,
    height: `${rect.height}%`,
  };
}
